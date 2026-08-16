use soroban_sdk::{contracttype, Address, String, Vec, Env, Symbol};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum SplitStatus {
    Pending,
    Executing,
    Completed,
    PartiallyCompleted,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum SplitType {
    Percentage,
    FixedAmount,
    Milestone,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    Pending,
    Triggered,
    Completed,
    Skipped,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recipient {
    pub address: Address,
    pub percentage: i128, // For percentage-based splits
    pub fixed_amount: i128, // For fixed amount splits
    pub split_type: SplitType,
    pub distributed_amount: i128,
    pub distribution_status: SplitStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub milestone_id: String,
    pub description: String,
    pub trigger_condition: String,
    pub required_amount: i128,
    pub status: MilestoneStatus,
    pub triggered_at: u64,
    pub completed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentSplit {
    pub split_id: String,
    pub payment_id: String,
    pub merchant_address: Address,
    pub total_amount: i128,
    pub currency: Address,
    pub split_type: SplitType,
    pub status: SplitStatus,
    pub recipients: Vec<Recipient>,
    pub milestones: Vec<Milestone>,
    pub created_at: u64,
    pub executed_at: u64,
    pub completed_at: u64,
    pub retry_count: u32,
    pub max_retries: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitDistribution {
    pub distribution_id: String,
    pub split_id: String,
    pub recipient_address: Address,
    pub amount: i128,
    pub transaction_hash: Symbol,
    pub status: SplitStatus,
    pub attempted_at: u64,
    pub completed_at: u64,
    pub error_message: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum Error {
    SplitNotFound,
    InvalidPercentage,
    InvalidAmount,
    SplitAlreadyExecuted,
    SplitCancelled,
    InsufficientBalance,
    InvalidRecipient,
    MilestoneNotTriggered,
    MaxRetriesExceeded,
    Unauthorized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SplitConfig {
    pub max_recipients: u32,
    pub max_retries: u32,
    pub min_split_percentage: i128,
    pub max_split_percentage: i128,
    pub require_merchant_approval: bool,
    pub enable_auto_retry: bool,
}
