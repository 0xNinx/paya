#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec, Symbol};

mod types;
mod storage;
mod logic;

use crate::types::{
    PaymentSplit, Recipient, Milestone, SplitDistribution, SplitStatus, 
    SplitType, MilestoneStatus, Error, SplitConfig
};
use crate::logic::{
    create_split, execute_split, distribute_to_recipient, confirm_distribution,
    fail_distribution, trigger_milestone, complete_milestone, cancel_split,
    retry_failed_distributions
};
use crate::storage::{get_split, get_distribution, get_config, set_config};

#[contract]
pub struct PaymentSplitContract;

#[contractimpl]
impl PaymentSplitContract {
    /// Initialize the contract with default configuration
    pub fn init(env: Env, config: SplitConfig) {
        set_config(&env, &config);
    }

    /// Create a new payment split
    pub fn create_split(
        env: Env,
        split_id: String,
        payment_id: String,
        merchant_address: Address,
        total_amount: i128,
        currency: Address,
        split_type: SplitType,
        recipients: Vec<Recipient>,
        milestones: Vec<Milestone>,
    ) -> Result<PaymentSplit, Error> {
        create_split(
            &env,
            split_id,
            payment_id,
            merchant_address,
            total_amount,
            currency,
            split_type,
            recipients,
            milestones,
        )
    }

    /// Execute a payment split (begin distribution)
    pub fn execute_split(env: Env, split_id: String, executor: Address) -> Result<PaymentSplit, Error> {
        execute_split(&env, split_id, executor)
    }

    /// Distribute funds to a specific recipient
    pub fn distribute_to_recipient(
        env: Env,
        split_id: String,
        recipient_address: Address,
        amount: i128,
        distribution_id: String,
    ) -> Result<SplitDistribution, Error> {
        distribute_to_recipient(&env, split_id, recipient_address, amount, distribution_id)
    }

    /// Confirm a successful distribution
    pub fn confirm_distribution(
        env: Env,
        distribution_id: String,
        transaction_hash: Symbol,
    ) -> Result<SplitDistribution, Error> {
        confirm_distribution(&env, distribution_id, transaction_hash)
    }

    /// Mark a distribution as failed
    pub fn fail_distribution(
        env: Env,
        distribution_id: String,
        error_message: String,
    ) -> Result<SplitDistribution, Error> {
        fail_distribution(&env, distribution_id, error_message)
    }

    /// Trigger a milestone for milestone-based splits
    pub fn trigger_milestone(
        env: Env,
        split_id: String,
        milestone_id: String,
        triggerer: Address,
    ) -> Result<Milestone, Error> {
        trigger_milestone(&env, split_id, milestone_id, triggerer)
    }

    /// Complete a milestone
    pub fn complete_milestone(
        env: Env,
        split_id: String,
        milestone_id: String,
        completer: Address,
    ) -> Result<Milestone, Error> {
        complete_milestone(&env, split_id, milestone_id, completer)
    }

    /// Cancel a pending split
    pub fn cancel_split(env: Env, split_id: String, canceller: Address) -> Result<PaymentSplit, Error> {
        cancel_split(&env, split_id, canceller)
    }

    /// Retry failed distributions
    pub fn retry_failed_distributions(
        env: Env,
        split_id: String,
        retryer: Address,
    ) -> Result<PaymentSplit, Error> {
        retry_failed_distributions(&env, split_id, retryer)
    }

    /// Get split details
    pub fn get_split(env: Env, split_id: String) -> Result<PaymentSplit, Error> {
        get_split(&env, &split_id)
    }

    /// Get distribution details
    pub fn get_distribution(env: Env, distribution_id: String) -> Result<SplitDistribution, Error> {
        get_distribution(&env, &distribution_id)
    }

    /// Get contract configuration
    pub fn get_config(env: Env) -> SplitConfig {
        get_config(&env)
    }

    /// Update contract configuration (only admin)
    pub fn update_config(env: Env, admin: Address, new_config: SplitConfig) -> Result<(), Error> {
        // In production, add proper admin authentication
        set_config(&env, &new_config);
        Ok(())
    }
}
