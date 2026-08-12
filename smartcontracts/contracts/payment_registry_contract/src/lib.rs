#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};
use core::option::Option;

#[derive(Clone)]
pub struct Payment {
    amount: i128,
    merchant: Address,
    status: Symbol, // "PENDING" or "PAID"
    tx_hash: Option<Symbol>,
}

#[contract]
pub struct PaymentRegistry;

mod storage {
    use soroban_sdk::Symbol;

    pub fn payments_key() -> Symbol {
        Symbol::short("PAYMENTS")
    }
}

#[contractimpl]
impl PaymentRegistry {
    pub fn create_payment(env: Env, id: Symbol, amount: i128, merchant: Address) {
        let key = id.clone();
        // store tuple (amount, merchant, status, tx_hash) under key
        env.storage().persistent().set(&key, &(amount, merchant, symbol_short!("PENDING"), Option::<Symbol>::None));
    }

    pub fn mark_paid(env: Env, id: Symbol, tx_hash: Symbol) {
        let maybe: Option<(i128, Address, Symbol, Option<Symbol>)> = env.storage().persistent().get(&id);
        match maybe {
            Option::None => {
                panic!("payment-not-found")
            }
            Option::Some((amount, merchant, _status, _)) => {
                env.storage().persistent().set(&id, &(amount, merchant, symbol_short!("PAID"), Option::Some(tx_hash)));
            }
        }
    }

    pub fn get_payment(env: Env, id: Symbol) -> (i128, Address, Symbol, Option<Symbol>) {
        let maybe: Option<(i128, Address, Symbol, Option<Symbol>)> = env.storage().persistent().get(&id);
        match maybe {
            Option::None => panic!("payment-not-found"),
            Option::Some(t) => t,
        }
    }
}
