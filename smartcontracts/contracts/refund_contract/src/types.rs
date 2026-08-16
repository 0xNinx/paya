use soroban_sdk::{contracttype, contracterror, Address, String, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    RefundAdmin,
    Refund(String),
    Dispute(String),
    RefundPolicy,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAuthorized = 1,
    RefundNotFound = 2,
    DisputeNotFound = 3,
    InvalidRefundAmount = 4,
    RefundWindowExpired = 5,
    PaymentAlreadyRefunded = 6,
    InvalidDisputeStatus = 7,
    InsufficientFunds = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RefundStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Reversed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RefundReason {
    CustomerRequest,
    ProductNotReceived,
    ProductDefective,
    WrongItem,
    DuplicatePayment,
    Fraudulent,
    Other(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RefundType {
    Full,
    Partial,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundRecord {
    pub refund_id: String,
    pub payment_id: String,
    pub merchant_address: Address,
    pub customer_address: Address,
    pub amount: i128,
    pub refund_type: RefundType,
    pub reason: RefundReason,
    pub status: RefundStatus,
    pub fee_amount: i128,
    pub net_amount: i128,
    pub created_at: u64,
    pub processed_at: Option<u64>,
    pub transaction_hash: Option<Symbol>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeStatus {
    Open,
    UnderReview,
    EvidenceRequired,
    Responding,
    Resolved,
    Closed,
    Won,
    Lost,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeReason {
    ProductNotReceived,
    ProductNotAsDescribed,
    UnauthorizedTransaction,
    DuplicateCharge,
    CreditNotProcessed,
    Other(String),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DisputeRecord {
    pub dispute_id: String,
    pub payment_id: String,
    pub refund_id: Option<String>,
    pub merchant_address: Address,
    pub customer_address: Address,
    pub amount: i128,
    pub reason: DisputeReason,
    pub status: DisputeStatus,
    pub evidence_count: u32,
    pub created_at: u64,
    pub due_date: u64,
    pub resolved_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RefundPolicy {
    pub refund_window_days: u32,
    pub processing_fee_percentage: u32,
    pub minimum_fee: i128,
    pub auto_approve_threshold: i128,
}
