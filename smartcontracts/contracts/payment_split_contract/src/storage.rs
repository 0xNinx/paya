use soroban_sdk::{Env, Symbol, Vec, Map};
use crate::types::{PaymentSplit, SplitDistribution, SplitConfig, Error};

const DATA_KEY_SPLIT: Symbol = Symbol::short("SPLIT");
const DATA_KEY_DISTRIBUTION: Symbol = Symbol::short("DIST");
const DATA_KEY_CONFIG: Symbol = Symbol::short("CONF");

pub fn get_split(env: &Env, split_id: &String) -> Result<PaymentSplit, Error> {
    let key = (DATA_KEY_SPLIT, split_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::SplitNotFound)
}

pub fn set_split(env: &Env, split_id: &String, split: &PaymentSplit) {
    let key = (DATA_KEY_SPLIT, split_id.clone());
    env.storage().persistent().set(&key, split);
}

pub fn get_distribution(env: &Env, distribution_id: &String) -> Result<SplitDistribution, Error> {
    let key = (DATA_KEY_DISTRIBUTION, distribution_id.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::SplitNotFound)
}

pub fn set_distribution(env: &Env, distribution_id: &String, distribution: &SplitDistribution) {
    let key = (DATA_KEY_DISTRIBUTION, distribution_id.clone());
    env.storage().persistent().set(&key, distribution);
}

pub fn get_config(env: &Env) -> SplitConfig {
    let key = DATA_KEY_CONFIG;
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(SplitConfig {
            max_recipients: 50,
            max_retries: 3,
            min_split_percentage: 1,
            max_split_percentage: 100,
            require_merchant_approval: true,
            enable_auto_retry: true,
        })
}

pub fn set_config(env: &Env, config: &SplitConfig) {
    let key = DATA_KEY_CONFIG;
    env.storage().persistent().set(&key, config);
}

pub fn has_split(env: &Env, split_id: &String) -> bool {
    let key = (DATA_KEY_SPLIT, split_id.clone());
    env.storage().persistent().has(&key)
}

pub fn remove_split(env: &Env, split_id: &String) {
    let key = (DATA_KEY_SPLIT, split_id.clone());
    env.storage().persistent().remove(&key);
}
