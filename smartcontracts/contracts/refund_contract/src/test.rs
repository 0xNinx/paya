use soroban_sdk::{Address, Env, Symbol};
use crate::types::{
    RefundStatus, RefundReason, RefundType, DisputeStatus, 
    DisputeReason, RefundPolicy, Error
};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);

    client.initialize(&admin, &policy);
    
    let retrieved_policy = client.get_policy();
    assert_eq!(retrieved_policy.refund_window_days, 30);
}

#[test]
fn test_create_full_refund() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let refund_id = Symbol::new(&env, "refund_1");
    let payment_id = Symbol::new(&env, "payment_1");
    let current_time = env.ledger().timestamp();

    client.create_refund(
        &refund_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &RefundType::Full,
        None::<i128>,
        &RefundReason::CustomerRequest,
        &current_time,
    );

    let refund = client.get_refund(&refund_id.to_string()).unwrap();
    assert_eq!(refund.amount, 10000);
    assert_eq!(refund.status, RefundStatus::Pending);
}

#[test]
fn test_create_partial_refund() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let refund_id = Symbol::new(&env, "refund_2");
    let payment_id = Symbol::new(&env, "payment_2");
    let current_time = env.ledger().timestamp();

    client.create_refund(
        &refund_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &RefundType::Partial,
        Some(5000),
        &RefundReason::ProductDefective,
        &current_time,
    );

    let refund = client.get_refund(&refund_id.to_string()).unwrap();
    assert_eq!(refund.amount, 5000);
    assert_eq!(refund.net_amount, 4750); // 5000 - 5% fee
}

#[test]
fn test_refund_window_expired() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let refund_id = Symbol::new(&env, "refund_3");
    let payment_id = Symbol::new(&env, "payment_3");
    let old_time = env.ledger().timestamp() - (31 * 24 * 60 * 60);

    let result = client.try_create_refund(
        &refund_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &RefundType::Full,
        None::<i128>,
        &RefundReason::CustomerRequest,
        &old_time,
    );

    assert_eq!(result, Err(Ok(Error::RefundWindowExpired)));
}

#[test]
fn test_process_refund() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let refund_id = Symbol::new(&env, "refund_4");
    let payment_id = Symbol::new(&env, "payment_4");
    let current_time = env.ledger().timestamp();

    client.create_refund(
        &refund_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &RefundType::Full,
        None::<i128>,
        &RefundReason::CustomerRequest,
        &current_time,
    );

    let tx_hash = Symbol::new(&env, "tx_123");
    client.process_refund(&refund_id.to_string(), &tx_hash.to_string());

    let refund = client.get_refund(&refund_id.to_string()).unwrap();
    assert_eq!(refund.status, RefundStatus::Completed);
    assert!(refund.processed_at.is_some());
}

#[test]
fn test_create_dispute() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let dispute_id = Symbol::new(&env, "dispute_1");
    let payment_id = Symbol::new(&env, "payment_5");

    client.create_dispute(
        &dispute_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &DisputeReason::ProductNotReceived,
        &14,
    );

    let dispute = client.get_dispute(&dispute_id.to_string()).unwrap();
    assert_eq!(dispute.status, DisputeStatus::Open);
    assert_eq!(dispute.evidence_count, 0);
}

#[test]
fn test_add_evidence() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let dispute_id = Symbol::new(&env, "dispute_2");
    let payment_id = Symbol::new(&env, "payment_6");

    client.create_dispute(
        &dispute_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &DisputeReason::ProductNotAsDescribed,
        &14,
    );

    client.add_evidence(&dispute_id.to_string());

    let dispute = client.get_dispute(&dispute_id.to_string()).unwrap();
    assert_eq!(dispute.evidence_count, 1);
}

#[test]
fn test_update_dispute_status() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let dispute_id = Symbol::new(&env, "dispute_3");
    let payment_id = Symbol::new(&env, "payment_7");

    client.create_dispute(
        &dispute_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &DisputeReason::UnauthorizedTransaction,
        &14,
    );

    client.update_dispute_status(&dispute_id.to_string(), &DisputeStatus::UnderReview);

    let dispute = client.get_dispute(&dispute_id.to_string()).unwrap();
    assert_eq!(dispute.status, DisputeStatus::UnderReview);
}

#[test]
fn test_link_refund_to_dispute() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);
    
    let policy = RefundPolicy {
        refund_window_days: 30,
        processing_fee_percentage: 5,
        minimum_fee: 100,
        auto_approve_threshold: 1000,
    };

    let contract_id = env.register_contract(None, crate::RefundContract);
    let client = crate::RefundContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &policy);

    let dispute_id = Symbol::new(&env, "dispute_4");
    let payment_id = Symbol::new(&env, "payment_8");
    let refund_id = Symbol::new(&env, "refund_5");

    client.create_dispute(
        &dispute_id.to_string(),
        &payment_id.to_string(),
        &merchant,
        &customer,
        &10000,
        &DisputeReason::ProductNotReceived,
        &14,
    );

    client.link_refund(&dispute_id.to_string(), &refund_id.to_string());

    let dispute = client.get_dispute(&dispute_id.to_string()).unwrap();
    assert!(dispute.refund_id.is_some());
    assert_eq!(dispute.refund_id.unwrap(), refund_id.to_string());
}
