export interface TokenInterface {
    ca: string;
    mcap: number;
    holders: number;
    liq: number;
    top_holders_rate: number;
    renounced_mint: number;
    burn_rate: number;
    renounced_freeze: number;
    }

export interface Config {
    min_liquidity: number;
    min_holders: number;
    min_mcap: number;
    max_mcap: number;
    max_top_holders_ratio: number;
    renounced_mint: number;
    burn_rate: number;
    renounced_freeze: number;
    sniper_url: string;
    channels: string[];
    logging_channels: string[];
}