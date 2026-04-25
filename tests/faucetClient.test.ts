import { StellarClient } from '../src/client/stellarClient';
import { FaucetClient } from '../src/client/faucetClient';
import { AxionveraError, FaucetRateLimitError } from '../src/errors/axionveraError';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FaucetClient', () => {
  let stellarClient: StellarClient;
  let faucetClient: FaucetClient;

  beforeEach(() => {
    stellarClient = new StellarClient({ network: 'testnet' });
    faucetClient = new FaucetClient(stellarClient);
    jest.clearAllMocks();
  });

  it('should fund an account on testnet', async () => {
    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const publicKey = 'GB6...123';
    
    await faucetClient.fundAccount(publicKey);
    
    expect(mockedAxios.get).toHaveBeenCalledWith(`https://friendbot.stellar.org/?addr=${publicKey}`);
  });

  it('should fund an account on futurenet', async () => {
    stellarClient = new StellarClient({ network: 'futurenet' });
    faucetClient = new FaucetClient(stellarClient);
    mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} });
    const publicKey = 'GB6...123';
    
    await faucetClient.fundAccount(publicKey);
    
    expect(mockedAxios.get).toHaveBeenCalledWith(`https://friendbot-futurenet.stellar.org/?addr=${publicKey}`);
  });

  it('should throw AxionveraError on mainnet', async () => {
    stellarClient = new StellarClient({ network: 'mainnet' });
    faucetClient = new FaucetClient(stellarClient);
    const publicKey = 'GB6...123';
    
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow(AxionveraError);
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow('Friendbot is not available on Mainnet');
  });

  it('should throw FaucetRateLimitError on 429 response', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { detail: 'Rate limit exceeded' }
      }
    });
    
    const publicKey = 'GB6...123';
    
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow(FaucetRateLimitError);
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow('Friendbot rate limit exceeded');
  });

  it('should throw AxionveraError on other errors', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { detail: 'Internal Server Error' }
      }
    });
    
    const publicKey = 'GB6...123';
    
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow(AxionveraError);
    await expect(faucetClient.fundAccount(publicKey)).rejects.toThrow('Failed to fund account');
  });
});
