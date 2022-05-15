const { strict: assert } = require('assert');
const sigUtil = require('eth-sig-util');

const normalizeAddress = sigUtil.normalize;
const sinon = require('sinon');
const Wallet = require('ethereumjs-wallet').default;

const KeyringController = require('..');
const mockEncryptor = require('./lib/mock-encryptor');

const password = 'password123';
const walletOneSeedWords =
  'puzzle seed penalty soldier say clay field arctic metal hen cage runway';
const walletOneAddresses = ['0xef35ca8ebb9669a35c31b5f6f249a9941a812ac1'];

const walletTwoSeedWords =
  'urge letter protect palace city barely security section midnight wealth south deer';

const walletTwoAddresses = [
  '0xbbafcf3d00fb625b65bb1497c94bf42c1f4b3e78',
  '0x49dd2653f38f75d40fdbd51e83b9c9724c87f7eb',
];
describe('KeyringController', function () {
  let keyringController;

  beforeEach(async function () {
    keyringController = new KeyringController({
      encryptor: mockEncryptor,
    });

    await keyringController.createNewVaultAndKeychain(password);
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('setLocked', function () {
    it('setLocked correctly sets lock state', async function () {
      assert.notDeepEqual(
        keyringController.keyrings,
        [],
        'keyrings should not be empty',
      );

      await keyringController.setLocked();

      expect(keyringController.password).toBeNull();
      expect(keyringController.memStore.getState().isUnlocked).toBe(false);
      expect(keyringController.keyrings).toHaveLength(0);
    });

    it('emits "lock" event', async function () {
      const spy = sinon.spy();
      keyringController.on('lock', spy);

      await keyringController.setLocked();

      expect(spy.calledOnce).toBe(true);
    });
  });

  describe('submitPassword', function () {
    it('should not create new keyrings when called in series', async function () {
      await keyringController.createNewVaultAndKeychain(password);
      await keyringController.persistAllKeyrings();
      expect(keyringController.keyrings).toHaveLength(1);

      await keyringController.submitPassword(`${password}a`);
      expect(keyringController.keyrings).toHaveLength(1);

      await keyringController.submitPassword('');
      expect(keyringController.keyrings).toHaveLength(1);
    });

    it('emits "unlock" event', async function () {
      await keyringController.setLocked();

      const spy = sinon.spy();
      keyringController.on('unlock', spy);

      await keyringController.submitPassword(password);
      expect(spy.calledOnce).toBe(true);
    });
  });

  describe('createNewVaultAndKeychain', function () {
    it('should set a vault on the configManager', async function () {
      keyringController.store.updateState({ vault: null });
      assert(!keyringController.store.getState().vault, 'no previous vault');

      await keyringController.createNewVaultAndKeychain(password);
      const { vault } = keyringController.store.getState();
      expect(vault).toBeTruthy();
    });

    it('should encrypt keyrings with the correct password each time they are persisted', async function () {
      keyringController.store.updateState({ vault: null });
      assert(!keyringController.store.getState().vault, 'no previous vault');

      await keyringController.createNewVaultAndKeychain(password);
      const { vault } = keyringController.store.getState();
      expect(vault).toBeTruthy();
      keyringController.encryptor.encrypt.args.forEach(([actualPassword]) => {
        expect(actualPassword).toBe(password);
      });
    });
  });

  describe('createNewVaultAndRestore', function () {
    it('clears old keyrings and creates a one', async function () {
      const initialAccounts = await keyringController.getAccounts();
      expect(initialAccounts).toHaveLength(1);
      await keyringController.addNewKeyring('Simple Key Pair');

      const allAccounts = await keyringController.getAccounts();
      expect(allAccounts).toHaveLength(2);

      await keyringController.createNewVaultAndRestore(
        password,
        walletOneSeedWords,
      );

      const allAccountsAfter = await keyringController.getAccounts();
      expect(allAccountsAfter).toHaveLength(1);
    });

    it('throws error if argument password is not a string', async function () {
      await expect(() =>
        keyringController.createNewVaultAndRestore(12, walletTwoSeedWords),
      ).rejects.toThrow('Password must be text.');
    });

    it('throws error if mnemonic passed is invalid', async function () {
      await expect(() =>
        keyringController.createNewVaultAndRestore(
          password,
          'test test test palace city barely security section midnight wealth south deer',
        ),
      ).rejects.toThrow('Seed phrase is invalid.');
    });
  });

  describe('addNewKeyring', function () {
    it('should add simple key pair', async function () {
      const privateKey =
        'c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3';
      const previousAccounts = await keyringController.getAccounts();
      const keyring = await keyringController.addNewKeyring('Simple Key Pair', [
        privateKey,
      ]);
      const keyringAccounts = await keyring.getAccounts();
      const expectedKeyringAccounts = [
        '0x627306090abab3a6e1400e9345bc60c78a8bef57',
      ];

      expect(keyringAccounts).toHaveLength(1);

      const allAccounts = await keyringController.getAccounts();
      const expectedAllAccounts = previousAccounts.concat(
        expectedKeyringAccounts,
      );
      expect(allAccounts).toHaveLength(2);
    });
  });

  describe('getAccounts', function () {
    it('returns the result of getAccounts for each keyring', async function () {
      keyringController.keyrings = [
        {
          getAccounts() {
            return Promise.resolve([1, 2, 3]);
          },
        },
        {
          getAccounts() {
            return Promise.resolve([4, 5, 6]);
          },
        },
      ];

      const result = await keyringController.getAccounts();
      expect(result).toStrictEqual([
        '0x01',
        '0x02',
        '0x03',
        '0x04',
        '0x05',
        '0x06',
      ]);
    });
  });

  describe('unlockKeyrings', function () {
    it('returns the list of keyrings', async function () {
      await keyringController.setLocked();
      const keyrings = await keyringController.unlockKeyrings(password);
      expect(keyrings).toHaveLength(1);
      keyrings.forEach((keyring) => {
        expect(keyring._wallets).toHaveLength(1);
      });
    });
  });

  describe('verifyPassword', function () {
    it('throws an error if no encrypted vault is in controller state', async function () {
      keyringController = new KeyringController({
        encryptor: mockEncryptor,
      });
      await expect(() =>
        keyringController.verifyPassword('test'),
      ).rejects.toThrow('Cannot unlock without a previous vault.');
    });
  });

  describe('addNewAccount', function () {
    it('adds a new account to the keyring it receives as an argument', async function () {

      const [HDKeyring] = await keyringController.getKeyringsByType('Simple Key Pair',);
      const initialAccounts = await HDKeyring.getAccounts();
      expect(initialAccounts).toHaveLength(1);

      await keyringController.addNewAccount(HDKeyring);
      const accountsAfterAdd = await HDKeyring.getAccounts();
      expect(accountsAfterAdd).toHaveLength(2);
    });
  });

  describe('forgetHardwareDevice', function () {
    it('throw when keyring is not hardware device', async function () {
      const privateKey =
        '0xb8a9c05beeedb25df85f8d641538cbffedf67216048de9c678ee26260eb91952';
      const keyring = await keyringController.addNewKeyring('Simple Key Pair', [
        privateKey,
      ]);
      expect(keyringController.keyrings).toHaveLength(2);
      expect(() => keyringController.forgetKeyring(keyring)).toThrow(
        new Error(
          'KeyringController - keyring does not have method "forgetDevice", keyring type: Simple Key Pair',
        ),
      );
    });
  });

  describe('getKeyringForAccount', function () {
    it('throws error when address is not provided', async function () {
      await expect(
        keyringController.getKeyringForAccount(undefined),
      ).rejects.toThrow(
        new Error(
          'No keyring found for the requested account. Error info: The address passed in is invalid/empty',
        ),
      );
    });

    it('throws error when there are no keyrings', async function () {
      keyringController.keyrings = [];
      await expect(
        keyringController.getKeyringForAccount('0x04'),
      ).rejects.toThrow(
        new Error(
          'No keyring found for the requested account. Error info: There are no keyrings',
        ),
      );
    });

    it('throws error when there are no matching keyrings', async function () {
      keyringController.keyrings = [
        {
          getAccounts() {
            return Promise.resolve([1, 2, 3]);
          },
        },
      ];
      await expect(
        keyringController.getKeyringForAccount('0x04'),
      ).rejects.toThrow(
        new Error(
          'No keyring found for the requested account. Error info: There are keyrings, but none match the address',
        ),
      );
    });
  });
});