use soroban_sdk::{Env, Symbol};
use crate::types::{DataKey, RefundRecord, DisputeRecord, RefundPolicy};

pub fn get_refund(env: &Env, refund_id: &Symbol) -> Option<RefundRecord> {
    let key = DataKey::Refund(refund_id.to_string());
    env.storage().persistent().get(&key)
}

pub fn set_refund(env: &Env, refund_id: &Symbol, record: &RefundRecord) {
    let key = DataKey::Refund(refund_id.to_string());
    env.storage().persistent().set(&key, record);
}

pub fn get_dispute(env: &Env, dispute_id: &Symbol) -> Option<DisputeRecord> {
    let key = DataKey::Dispute(dispute_id.to_string());
    env.storage().persistent().get(&key)
}

pub fn set_dispute(env: &Env, dispute_id: &Symbol, record: &DisputeRecord) {
    let key = DataKey::Dispute(dispute_id.to_string());
    env.storage().persistent().set(&key, record);
}

pub fn get_refund_policy(env: &Env) -> Option<RefundPolicy> {
    env.storage().persistent().get(&DataKey::RefundPolicy)
}

pub fn set_refund_policy(env: &Env, policy: &RefundPolicy) {
    env.storage().persistent().set(&DataKey::RefundPolicy, policy);
}

pub fn get_admin(env: &Env) -> Option<Symbol> {
    env.storage().persistent().get(&DataKey::RefundAdmin)
}

pub fn set_admin(env: &Env, admin: &Symbol) {
    env.storage().persistent().set(&DataKey::RefundAdmin, admin);
}

pub fn has_refund(env: &Env, refund_id: &Symbol) -> bool {
    get_refund(env, refund_id).is_some()
}

pub fn has_dispute(env: &Env, dispute_id: &Symbol) -> bool {
    get_dispute(env, dispute_id).is_some()
}
