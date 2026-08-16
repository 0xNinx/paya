use soroban_sdk::{Env, Address, String, Vec, Symbol};
use crate::types::{
    PaymentSplit, Recipient, Milestone, SplitDistribution, SplitStatus, 
    SplitType, MilestoneStatus, Error, SplitConfig
};
use crate::storage::{get_split, set_split, get_distribution, set_distribution, get_config, has_split};

pub fn validate_recipients(recipients: &Vec<Recipient>, split_type: &SplitType, config: &SplitConfig) -> Result<(), Error> {
    if recipients.len() == 0 {
        return Err(Error::InvalidRecipient);
    }

    if recipients.len() > config.max_recipients as usize {
        return Err(Error::InvalidRecipient);
    }

    match split_type {
        SplitType::Percentage => {
            let mut total_percentage: i128 = 0;
            for recipient in recipients.iter() {
                if recipient.percentage < config.min_split_percentage || 
                   recipient.percentage > config.max_split_percentage {
                    return Err(Error::InvalidPercentage);
                }
                total_percentage += recipient.percentage;
            }
            if total_percentage != 100 {
                return Err(Error::InvalidPercentage);
            }
        }
        SplitType::FixedAmount => {
            let mut total_fixed: i128 = 0;
            for recipient in recipients.iter() {
                if recipient.fixed_amount <= 0 {
                    return Err(Error::InvalidAmount);
                }
                total_fixed += recipient.fixed_amount;
            }
        }
        SplitType::Milestone => {
            // Milestone splits are validated differently
            for recipient in recipients.iter() {
                if recipient.percentage < config.min_split_percentage || 
                   recipient.percentage > config.max_split_percentage {
                    return Err(Error::InvalidPercentage);
                }
            }
        }
    }

    Ok(())
}

pub fn create_split(
    env: &Env,
    split_id: String,
    payment_id: String,
    merchant_address: Address,
    total_amount: i128,
    currency: Address,
    split_type: SplitType,
    recipients: Vec<Recipient>,
    milestones: Vec<Milestone>,
) -> Result<PaymentSplit, Error> {
    if has_split(env, &split_id) {
        return Err(Error::SplitAlreadyExecuted);
    }

    let config = get_config(env);
    validate_recipients(&recipients, &split_type, &config)?;

    let split = PaymentSplit {
        split_id: split_id.clone(),
        payment_id,
        merchant_address,
        total_amount,
        currency,
        split_type,
        status: SplitStatus::Pending,
        recipients,
        milestones,
        created_at: env.ledger().timestamp(),
        executed_at: 0,
        completed_at: 0,
        retry_count: 0,
        max_retries: config.max_retries,
    };

    set_split(env, &split_id, &split);
    Ok(split)
}

pub fn execute_split(env: &Env, split_id: String, executor: Address) -> Result<PaymentSplit, Error> {
    let mut split = get_split(env, &split_id)?;

    if split.status != SplitStatus::Pending {
        return Err(Error::SplitAlreadyExecuted);
    }

    if split.merchant_address != executor && get_config(env).require_merchant_approval {
        return Err(Error::Unauthorized);
    }

    split.status = SplitStatus::Executing;
    split.executed_at = env.ledger().timestamp();
    set_split(env, &split_id, &split);

    Ok(split)
}

pub fn distribute_to_recipient(
    env: &Env,
    split_id: String,
    recipient_address: Address,
    amount: i128,
    distribution_id: String,
) -> Result<SplitDistribution, Error> {
    let split = get_split(env, &split_id)?;

    if split.status != SplitStatus::Executing {
        return Err(Error::SplitAlreadyExecuted);
    }

    let distribution = SplitDistribution {
        distribution_id: distribution_id.clone(),
        split_id: split_id.clone(),
        recipient_address,
        amount,
        transaction_hash: Symbol::short("PENDING"),
        status: SplitStatus::Executing,
        attempted_at: env.ledger().timestamp(),
        completed_at: 0,
        error_message: String::from_str(env, ""),
    };

    set_distribution(env, &distribution_id, &distribution);
    Ok(distribution)
}

pub fn confirm_distribution(
    env: &Env,
    distribution_id: String,
    transaction_hash: Symbol,
) -> Result<SplitDistribution, Error> {
    let mut distribution = get_distribution(env, &distribution_id)?;
    
    distribution.status = SplitStatus::Completed;
    distribution.transaction_hash = transaction_hash;
    distribution.completed_at = env.ledger().timestamp();
    
    set_distribution(env, &distribution_id, &distribution);
    
    // Update split status if all distributions are complete
    update_split_completion_status(env, &distribution.split_id);
    
    Ok(distribution)
}

pub fn fail_distribution(
    env: &Env,
    distribution_id: String,
    error_message: String,
) -> Result<SplitDistribution, Error> {
    let mut distribution = get_distribution(env, &distribution_id)?;
    
    distribution.status = SplitStatus::Failed;
    distribution.error_message = error_message;
    
    set_distribution(env, &distribution_id, &distribution);
    
    // Update split status and retry count
    let mut split = get_split(env, &distribution.split_id)?;
    split.retry_count += 1;
    
    if split.retry_count >= split.max_retries {
        split.status = SplitStatus::Failed;
    } else {
        split.status = SplitStatus::PartiallyCompleted;
    }
    
    set_split(env, &distribution.split_id, &split);
    
    Ok(distribution)
}

pub fn update_split_completion_status(env: &Env, split_id: &String) {
    if let Ok(mut split) = get_split(env, split_id) {
        let mut all_completed = true;
        let mut any_failed = false;
        
        for recipient in split.recipients.iter() {
            if recipient.distribution_status != SplitStatus::Completed {
                all_completed = false;
            }
            if recipient.distribution_status == SplitStatus::Failed {
                any_failed = true;
            }
        }
        
        if all_completed {
            split.status = SplitStatus::Completed;
            split.completed_at = env.ledger().timestamp();
        } else if any_failed {
            split.status = SplitStatus::PartiallyCompleted;
        }
        
        set_split(env, split_id, &split);
    }
}

pub fn trigger_milestone(
    env: &Env,
    split_id: String,
    milestone_id: String,
    triggerer: Address,
) -> Result<Milestone, Error> {
    let mut split = get_split(env, &split_id)?;
    
    if split.merchant_address != triggerer {
        return Err(Error::Unauthorized);
    }
    
    let mut milestone_found = false;
    for milestone in split.milestones.iter_mut() {
        if milestone.milestone_id == milestone_id {
            if milestone.status != MilestoneStatus::Pending {
                return Err(Error::MilestoneNotTriggered);
            }
            milestone.status = MilestoneStatus::Triggered;
            milestone.triggered_at = env.ledger().timestamp();
            milestone_found = true;
            break;
        }
    }
    
    if !milestone_found {
        return Err(Error::MilestoneNotTriggered);
    }
    
    set_split(env, &split_id, &split);
    
    // Return the updated milestone
    for milestone in split.milestones.iter() {
        if milestone.milestone_id == milestone_id {
            return Ok(milestone.clone());
        }
    }
    
    Err(Error::MilestoneNotTriggered)
}

pub fn complete_milestone(
    env: &Env,
    split_id: String,
    milestone_id: String,
    completer: Address,
) -> Result<Milestone, Error> {
    let mut split = get_split(env, &split_id)?;
    
    if split.merchant_address != completer {
        return Err(Error::Unauthorized);
    }
    
    let mut milestone_found = false;
    for milestone in split.milestones.iter_mut() {
        if milestone.milestone_id == milestone_id {
            if milestone.status != MilestoneStatus::Triggered {
                return Err(Error::MilestoneNotTriggered);
            }
            milestone.status = MilestoneStatus::Completed;
            milestone.completed_at = env.ledger().timestamp();
            milestone_found = true;
            break;
        }
    }
    
    if !milestone_found {
        return Err(Error::MilestoneNotTriggered);
    }
    
    set_split(env, &split_id, &split);
    
    // Check if all milestones are completed
    let all_completed = split.milestones.iter().all(|m| m.status == MilestoneStatus::Completed);
    if all_completed {
        split.status = SplitStatus::Completed;
        split.completed_at = env.ledger().timestamp();
        set_split(env, &split_id, &split);
    }
    
    // Return the updated milestone
    for milestone in split.milestones.iter() {
        if milestone.milestone_id == milestone_id {
            return Ok(milestone.clone());
        }
    }
    
    Err(Error::MilestoneNotTriggered)
}

pub fn cancel_split(env: &Env, split_id: String, canceller: Address) -> Result<PaymentSplit, Error> {
    let mut split = get_split(env, &split_id)?;
    
    if split.merchant_address != canceller {
        return Err(Error::Unauthorized);
    }
    
    if split.status == SplitStatus::Completed || split.status == SplitStatus::Executing {
        return Err(Error::SplitAlreadyExecuted);
    }
    
    split.status = SplitStatus::Cancelled;
    set_split(env, &split_id, &split);
    
    Ok(split)
}

pub fn retry_failed_distributions(env: &Env, split_id: String, retryer: Address) -> Result<PaymentSplit, Error> {
    let mut split = get_split(env, &split_id)?;
    
    if split.merchant_address != retryer {
        return Err(Error::Unauthorized);
    }
    
    if split.retry_count >= split.max_retries {
        return Err(Error::MaxRetriesExceeded);
    }
    
    split.retry_count += 1;
    split.status = SplitStatus::Executing;
    
    // Reset failed recipients to pending
    for recipient in split.recipients.iter_mut() {
        if recipient.distribution_status == SplitStatus::Failed {
            recipient.distribution_status = SplitStatus::Pending;
        }
    }
    
    set_split(env, &split_id, &split);
    Ok(split)
}
