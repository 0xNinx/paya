use soroban_sdk::{Env, Address, Symbol};
use crate::types::{
    RefundRecord, DisputeRecord, RefundStatus, RefundReason, 
    RefundType, DisputeStatus, DisputeReason, RefundPolicy, Error
};
use crate::storage;

pub fn initialize(env: &Env, admin: Symbol, policy: RefundPolicy) {
    if storage::get_admin(env).is_some() {
        panic!("already-initialized");
    }
    storage::set_admin(env, &admin);
    storage::set_refund_policy(env, &policy);
}

pub fn calculate_refund_amount(
    original_amount: i128,
    refund_type: RefundType,
    partial_amount: Option<i128>,
    policy: &RefundPolicy
) -> Result<(i128, i128), Error> {
    let refund_amount = match refund_type {
        RefundType::Full => original_amount,
        RefundType::Partial => {
            partial_amount.ok_or(Error::InvalidRefundAmount)?
        }
    };

    if refund_amount <= 0 || refund_amount > original_amount {
        return Err(Error::InvalidRefundAmount);
    }

    let processing_fee = (refund_amount * policy.processing_fee_percentage as i128) / 100;
    let final_fee = processing_fee.max(policy.minimum_fee);
    let net_amount = refund_amount - final_fee;

    Ok((refund_amount, net_amount))
}

pub fn validate_refund_window(
    payment_timestamp: u64,
    current_timestamp: u64,
    policy: &RefundPolicy
) -> Result<(), Error> {
    let window_seconds = policy.refund_window_days as u64 * 24 * 60 * 60;
    
    if current_timestamp > payment_timestamp + window_seconds {
        return Err(Error::RefundWindowExpired);
    }
    
    Ok(())
}

pub fn create_refund(
    env: &Env,
    refund_id: Symbol,
    payment_id: Symbol,
    merchant: Address,
    customer: Address,
    original_amount: i128,
    refund_type: RefundType,
    partial_amount: Option<i128>,
    reason: RefundReason,
    payment_timestamp: u64
) -> Result<(), Error> {
    if storage::has_refund(env, &refund_id) {
        return Err(Error::PaymentAlreadyRefunded);
    }

    let policy = storage::get_refund_policy(env).ok_or(Error::RefundNotFound)?;
    validate_refund_window(payment_timestamp, env.ledger().timestamp(), &policy)?;

    let (refund_amount, net_amount) = calculate_refund_amount(
        original_amount,
        refund_type,
        partial_amount,
        &policy
    )?;

    let fee_amount = refund_amount - net_amount;

    let record = RefundRecord {
        refund_id: refund_id.to_string(),
        payment_id: payment_id.to_string(),
        merchant_address: merchant,
        customer_address: customer,
        amount: refund_amount,
        refund_type,
        reason,
        status: RefundStatus::Pending,
        fee_amount,
        net_amount,
        created_at: env.ledger().timestamp(),
        processed_at: None,
        transaction_hash: None,
    };

    storage::set_refund(env, &refund_id, &record);
    Ok(())
}

pub fn process_refund(
    env: &Env,
    refund_id: Symbol,
    tx_hash: Symbol
) -> Result<(), Error> {
    let mut record = storage::get_refund(env, &refund_id).ok_or(Error::RefundNotFound)?;

    if record.status != RefundStatus::Pending {
        return Err(Error::InvalidRefundAmount);
    }

    record.status = RefundStatus::Completed;
    record.processed_at = Some(env.ledger().timestamp());
    record.transaction_hash = Some(tx_hash);

    storage::set_refund(env, &refund_id, &record);
    Ok(())
}

pub fn fail_refund(env: &Env, refund_id: Symbol) -> Result<(), Error> {
    let mut record = storage::get_refund(env, &refund_id).ok_or(Error::RefundNotFound)?;

    if record.status != RefundStatus::Pending && record.status != RefundStatus::Processing {
        return Err(Error::InvalidRefundAmount);
    }

    record.status = RefundStatus::Failed;
    storage::set_refund(env, &refund_id, &record);
    Ok(())
}

pub fn reverse_refund(env: &Env, refund_id: Symbol) -> Result<(), Error> {
    let mut record = storage::get_refund(env, &refund_id).ok_or(Error::RefundNotFound)?;

    if record.status != RefundStatus::Completed {
        return Err(Error::InvalidRefundAmount);
    }

    record.status = RefundStatus::Reversed;
    storage::set_refund(env, &refund_id, &record);
    Ok(())
}

pub fn create_dispute(
    env: &Env,
    dispute_id: Symbol,
    payment_id: Symbol,
    merchant: Address,
    customer: Address,
    amount: i128,
    reason: DisputeReason,
    response_deadline_days: u32
) -> Result<(), Error> {
    if storage::has_dispute(env, &dispute_id) {
        return Err(Error::DisputeNotFound);
    }

    let current_timestamp = env.ledger().timestamp();
    let due_date = current_timestamp + (response_deadline_days as u64 * 24 * 60 * 60);

    let record = DisputeRecord {
        dispute_id: dispute_id.to_string(),
        payment_id: payment_id.to_string(),
        refund_id: None,
        merchant_address: merchant,
        customer_address: customer,
        amount,
        reason,
        status: DisputeStatus::Open,
        evidence_count: 0,
        created_at: current_timestamp,
        due_date,
        resolved_at: None,
    };

    storage::set_dispute(env, &dispute_id, &record);
    Ok(())
}

pub fn update_dispute_status(
    env: &Env,
    dispute_id: Symbol,
    new_status: DisputeStatus
) -> Result<(), Error> {
    let mut record = storage::get_dispute(env, &dispute_id).ok_or(Error::DisputeNotFound)?;

    record.status = new_status;
    
    if matches!(new_status, DisputeStatus::Resolved | DisputeStatus::Won | DisputeStatus::Lost | DisputeStatus::Closed) {
        record.resolved_at = Some(env.ledger().timestamp());
    }

    storage::set_dispute(env, &dispute_id, &record);
    Ok(())
}

pub fn add_evidence_to_dispute(env: &Env, dispute_id: Symbol) -> Result<(), Error> {
    let mut record = storage::get_dispute(env, &dispute_id).ok_or(Error::DisputeNotFound)?;
    record.evidence_count += 1;
    storage::set_dispute(env, &dispute_id, &record);
    Ok(())
}

pub fn link_refund_to_dispute(
    env: &Env,
    dispute_id: Symbol,
    refund_id: Symbol
) -> Result<(), Error> {
    let mut record = storage::get_dispute(env, &dispute_id).ok_or(Error::DisputeNotFound)?;
    record.refund_id = Some(refund_id.to_string());
    storage::set_dispute(env, &dispute_id, &record);
    Ok(())
}
