#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol, Option as SorobanOption};

#[contract]
pub struct PaymentRegistry;

#[contractimpl]
impl PaymentRegistry {
    pub fn create_payment(env: Env, id: Symbol, amount: i128, merchant: Address) {
        // store tuple (amount, merchant, status, tx_hash) under key = id
        env.storage().set(&id, &(amount, merchant, symbol_short!("PENDING"), SorobanOption::<Symbol>::None));
    }

    pub fn mark_paid(env: Env, id: Symbol, tx_hash: Symbol) {
        let maybe: SorobanOption<(i128, Address, Symbol, SorobanOption<Symbol>)> = env.storage().get(&id);
        match maybe {
            SorobanOption::None => {
                panic!("payment-not-found")
            }
            SorobanOption::Some((amount, merchant, _status, _)) => {
                env.storage().set(&id, &(amount, merchant, symbol_short!("PAID"), SorobanOption::Some(tx_hash)));
            }
        }
    }

    pub fn get_payment(env: Env, id: Symbol) -> (i128, Address, Symbol, SorobanOption<Symbol>) {
        let maybe: SorobanOption<(i128, Address, Symbol, SorobanOption<Symbol>)> = env.storage().get(&id);
        match maybe {
            SorobanOption::None => panic!("payment-not-found"),
            SorobanOption::Some(t) => t,
        }
    }
}
