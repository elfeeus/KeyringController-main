const { EventEmitter } = require('events');
const randomBytes = require('randombytes');

const { Client, PrivateKey, AccountCreateTransaction, TransferTransaction, AccountBalanceQuery, Hbar, AccountId } = require("@hashgraph/sdk");

require("dotenv").config();
const fs = require("fs");
const { hethers } = require("@hashgraph/hethers");
const { normalize } = require('@metamask/eth-sig-util');


const type = 'Simple Key Pair';

class SimpleKeyring extends EventEmitter {

  constructor() {
    super();
    // hedera port
    this.type = type;
    this._wallets = [];
  }

  async serialize() {
    return this._wallets.map(({ privateKey }) => privateKey.toString('hex'));
  }

  async deserialize(privateKeys = []) {

    for (let i = 0; i < privateKeys.length; i++) {

      const privateKey = await PrivateKey.generateECDSA(); 
      const publicKey = privateKey.publicKey;

      // hedera port
      const address = await this.hederaPubToAddress(publicKey);
      this._wallets.push({ privateKey, publicKey, address });

    }
  }

    isHexPrefixed(str) {
      if (typeof str !== 'string') {
        throw new Error("[is-hex-prefixed] value must be type 'string', is currently type " + (typeof str) + ", while checking isHexPrefixed.");
      }

      return str.slice(0, 2) === '0x';
    }

   stripHexPrefix(str) {
      if (typeof str !== 'string') {
        return str;
      }

      return this.isHexPrefixed(str) ? str.slice(2) : str;
    }
  
  async addAccounts(n = 1) {
    const newWallets = [];
    for (let i = 0; i < n; i++) {

      
      const privateKey = await PrivateKey.generateECDSA(); 
      const publicKey = privateKey.publicKey;

      // hedera port
      const address = await this.hederaPubToAddress(publicKey);

      newWallets.push({ privateKey, publicKey, address });
    }
    this._wallets = this._wallets.concat(newWallets);
    const hexWallets = newWallets.map(({address}) =>
      // hedera port
      address,
    );
    return hexWallets;
  }

  async hederaPubToAddress(publicKey){

    const client = Client.forTestnet();
    const provider = hethers.providers.getDefaultProvider("testnet");

    //Grab your Hedera testnet account ID and private key from your .env file
    const myAccountId = process.env.MY_ACCOUNT_ID;
    const myPrivateKey = process.env.MY_PRIVATE_KEY;

    // If we weren't able to grab it, we should throw a new error
    if (myAccountId == null ||
        myPrivateKey == null ) {
        throw new Error("Environment variables myAccountId and myPrivateKey must be present");
    }

    // Create our connection to the Hedera network
    client.setOperator(myAccountId, myPrivateKey);

    //Create a new account with 1,000 tinybar starting balance
    const newAccount = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(Hbar.fromTinybars(1000))
    .execute(client);


    // Get the new account ID
    const getReceipt = await newAccount.getReceipt(client);
    const newAccountId = getReceipt.accountId;
    const walletAddress = hethers.utils.getAddressFromAccount(newAccountId);
    
    return walletAddress;
  }

    
  // hedera port
  async publicToAddress(publicKey) {
    //Create a new account with 1,000 tinybar starting balance
    const accountCreate = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(Hbar.fromTinybars(1000))
    .execute(client);
    
    // Get the new account ID
    const getReceipt = await newAccount.getReceipt(client);
    const newAccountId = getReceipt.accountId;

    const walletAddress = hethers.utils.getAddressFromAccount(newAccountId);

    return walletAddress;
  }

  async getAccounts() {

      return Promise.resolve(
      this._wallets.map((w) => {
        return normalize(w.address.toString('hex'));
      }),
    );

    //eturn this._wallets;
  }

  // tx is an instance of the ethereumjs-transaction class.
  async signTransaction(address, tx, opts = {}) {
    const privKey = this._getPrivateKeyFor(address, opts);

    const newAccountId = hethers.utils.getAccountFromAddress(address);

    const eoaAccount = {
        account: newAccountId,
        privateKey: `0x${privKey.toStringRaw()}`, // Convert private key to short format using .toStringRaw()
    };

    const provider = hethers.providers.getDefaultProvider("testnet");    
    const wallet = new hethers.Wallet(eoaAccount, provider);  
    const signedTx = await wallet.signTransaction(tx);

    return signedTx === undefined ? tx : signedTx;
  }

  // For eth_sign, we need to sign arbitrary data:
  async signMessage(address, data, opts = {}) {
    
    const message = data;
    const privKey = this._getPrivateKeyFor(address, opts);

    
    const newAccountId = hethers.utils.getAccountFromAddress(address);

    const eoaAccount = {
        account: newAccountId,
        privateKey: `0x${privKey.toStringRaw()}`, // Convert private key to short format using .toStringRaw()
    };

    const provider = hethers.providers.getDefaultProvider("testnet");

    
    const wallet = new hethers.Wallet(eoaAccount, provider);
    const rawMsgSig = await wallet.signMessage(message);
    
    return rawMsgSig;
  }

  _getPrivateKeyFor(address, opts = {}) {
    if (!address) {
      throw new Error('Must specify address.');
    }
    const wallet = this._getWalletForAccount(address, opts);
    return wallet.privateKey;
  }

  // exportAccount should return a hex-encoded private key:
  async exportAccount(address, opts = {}) {
    const wallet = this._getWalletForAccount(address, opts);
    return wallet.privateKey.toString('hex');
  }

  removeAccount(myaddress) {
    if (
      !this._wallets
        .map(({ address }) =>
          address,
        )
        .includes(myaddress.toLowerCase())
    ) {
      throw new Error(`Address ${myaddress} not found in this keyring`);
    }

    this._wallets = this._wallets.filter(
      ({ address }) =>
          address
          .toLowerCase() !== myaddress.toLowerCase(),
    );
  }

  /**
   * @private
   */
  _getWalletForAccount(account, opts = {}) {

    // hedera port
    let wallet = this._wallets.find(
      ({ address }) =>
        // hedera port
        address,
    );
    if (!wallet) {
      throw new Error('Simple Keyring - Unable to find matching address.');
    }
    
    
    if (!wallet) {
      throw new Error('Simple Keyring - Unable to find matching address.');
    }

    return wallet;
  }
}

SimpleKeyring.type = type;
module.exports = SimpleKeyring;