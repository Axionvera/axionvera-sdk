import { ethers } from 'ethers';
import { VaultABI } from './abis/VaultABI';

export interface VaultConfig {
  contractAddress: string;
  provider: ethers.providers.Provider | ethers.Signer;
}

export interface DepositParams {
  amount: ethers.BigNumberish;
  asset?: string;
  referralCode?: string;
}

export interface WithdrawParams {
  amount: ethers.BigNumberish;
  asset?: string;
}

export interface VaultInfo {
  totalAssets: ethers.BigNumber;
  totalSupply: ethers.BigNumber;
  apy: number;
  lockPeriod: number;
}

export class Vault {
  private contract: ethers.Contract;
  private provider: ethers.providers.Provider | ethers.Signer;
  private address: string;

  constructor(config: VaultConfig) {
    this.address = config.contractAddress;
    this.provider = config.provider;
    this.contract = new ethers.Contract(
      config.contractAddress,
      VaultABI,
      config.provider
    );
  }

  /**
   * Connect to vault with signer for write operations
   */
  connect(signer: ethers.Signer): Vault {
    return new Vault({
      contractAddress: this.address,
      provider: signer,
    });
  }

  /**
   * Get vault information (total assets, total supply, APY, lock period)
   */
  async getVaultInfo(): Promise<VaultInfo> {
    const [totalAssets, totalSupply, apy, lockPeriod] = await Promise.all([
      this.contract.totalAssets(),
      this.contract.totalSupply(),
      this.contract.apy(),
      this.contract.lockPeriod(),
    ]);

    return {
      totalAssets,
      totalSupply,
      apy: apy.toNumber() / 10000,
      lockPeriod: lockPeriod.toNumber(),
    };
  }

  /**
   * Get user's vault balance
   * @param userAddress - Address of the user
   * @returns User's balance in vault shares
   */
  async getBalance(userAddress: string): Promise<ethers.BigNumber> {
    return this.contract.balanceOf(userAddress);
  }

  /**
   * Get user's underlying assets balance
   * @param userAddress - Address of the user
   * @returns Converted balance in underlying asset
   */
  async getAssetsBalance(userAddress: string): Promise<ethers.BigNumber> {
    const shares = await this.getBalance(userAddress);
    return this.convertToAssets(shares);
  }

  /**
   * Convert shares to underlying assets
   */
  async convertToAssets(shares: ethers.BigNumberish): Promise<ethers.BigNumber> {
    return this.contract.convertToAssets(shares);
  }

  /**
   * Convert underlying assets to shares
   */
  async convertToShares(assets: ethers.BigNumberish): Promise<ethers.BigNumber> {
    return this.contract.convertToShares(assets);
  }

  /**
   * Deposit assets into vault
   * @param params - Deposit parameters
   * @param signer - Optional signer (uses connected signer if not provided)
   */
  async deposit(params: DepositParams, signer?: ethers.Signer): Promise<ethers.ContractTransaction> {
    const signerToUse = signer || (this.provider as ethers.Signer);
    
    if (!signerToUse || !('sendTransaction' in signerToUse)) {
      throw new Error('Signer required for deposit operation');
    }

    const contractWithSigner = this.contract.connect(signerToUse);
    const tx = await contractWithSigner.deposit(params.amount, {
      value: params.amount,
    });
    
    return tx;
  }

  /**
   * Withdraw assets from vault
   * @param params - Withdraw parameters
   * @param signer - Optional signer (uses connected signer if not provided)
   */
  async withdraw(params: WithdrawParams, signer?: ethers.Signer): Promise<ethers.ContractTransaction> {
    const signerToUse = signer || (this.provider as ethers.Signer);
    
    if (!signerToUse || !('sendTransaction' in signerToUse)) {
      throw new Error('Signer required for withdraw operation');
    }

    const contractWithSigner = this.contract.connect(signerToUse);
    const tx = await contractWithSigner.withdraw(
      params.amount,
      await signerToUse.getAddress(),
      await signerToUse.getAddress()
    );
    
    return tx;
  }

  /**
   * Claim pending rewards
   * @param signer - Optional signer (uses connected signer if not provided)
   */
  async claimRewards(signer?: ethers.Signer): Promise<ethers.ContractTransaction> {
    const signerToUse = signer || (this.provider as ethers.Signer);
    
    if (!signerToUse || !('sendTransaction' in signerToUse)) {
      throw new Error('Signer required for claim rewards operation');
    }

    const contractWithSigner = this.contract.connect(signerToUse);
    const tx = await contractWithSigner.claimRewards();
    
    return tx;
  }

  /**
   * Get pending rewards for a user
   * @param userAddress - Address of the user
   */
  async getPendingRewards(userAddress: string): Promise<ethers.BigNumber> {
    return this.contract.pendingRewards(userAddress);
  }

  /**
   * Estimate deposit gas cost
   */
  async estimateDepositGas(amount: ethers.BigNumberish): Promise<ethers.BigNumber> {
    return this.contract.estimateGas.deposit(amount);
  }

  /**
   * Estimate withdraw gas cost
   */
  async estimateWithdrawGas(amount: ethers.BigNumberish): Promise<ethers.BigNumber> {
    return this.contract.estimateGas.withdraw(amount);
  }
}

export default Vault;