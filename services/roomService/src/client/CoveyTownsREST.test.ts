import Express from 'express';
import CORS from 'cors';
import http from 'http';
import {nanoid} from 'nanoid';
import assert from 'assert';
import {AddressInfo} from 'net';

import TownsServiceClient, {TownListResponse} from './TownsServiceClient';
import addTownRoutes from '../router/towns';
import TwilioChat from '../lib/TwilioChat';

jest.mock('../lib/TwilioChat');

const mockGetChatTokenForTown = jest.fn();
const mockCreateChannelWithBot = jest.fn();
const mockCreateChannel = jest.fn();
const mockSendInvite = jest.fn();
const mockUpdateChannel = jest.fn();
const mockGetChannels = jest.fn();
const mockDeleteChannel = jest.fn();

// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioChat.getInstance = () => ({
  getToken: mockGetChatTokenForTown,
  createChannelWithBot: mockCreateChannelWithBot,
  createChannel: mockCreateChannel,
  sendInvite: mockSendInvite,
  deleteChannel: mockDeleteChannel,
  updateChannel: mockUpdateChannel,
  getChannels: mockGetChannels,
});

mockCreateChannel.mockReturnValue(Promise.resolve({
  sid: nanoid(),
}));

mockGetChatTokenForTown.mockReturnValue(Promise.resolve(nanoid()));

type TestTownData = {
  friendlyName: string, coveyTownID: string,
  isPubliclyListed: boolean, townUpdatePassword: string
};

function expectTownListMatches(towns: TownListResponse, town: TestTownData) {
  const matching = towns.towns.find(townInfo => townInfo.coveyTownID === town.coveyTownID);
  if (town.isPubliclyListed) {
    expect(matching)
      .toBeDefined();
    assert(matching);
    expect(matching.friendlyName)
      .toBe(town.friendlyName);
  } else {
    expect(matching)
      .toBeUndefined();
  }
}

describe('TownsServiceAPIREST', () => {
  let server: http.Server;
  let apiClient: TownsServiceClient;

  async function createTownForTesting(friendlyNameToUse?: string, isPublic = false): Promise<TestTownData> {
    const friendlyName = friendlyNameToUse !== undefined ? friendlyNameToUse :
      `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
    const ret = await apiClient.createTown({
      friendlyName,
      isPubliclyListed: isPublic,
    });
    return {
      friendlyName,
      isPubliclyListed: isPublic,
      coveyTownID: ret.coveyTownID,
      townUpdatePassword: ret.coveyTownPassword,
    };
  }

  beforeAll(async () => {
    const app = Express();
    app.use(CORS());
    server = http.createServer(app);

    addTownRoutes(server, app);
    await server.listen();
    const address = server.address() as AddressInfo;

    apiClient = new TownsServiceClient(`http://127.0.0.1:${address.port}`);
  });
  afterAll(async () => {
    await server.close();
  });
  describe('CoveyTownCreateAPI', () => {
    it('Allows for multiple towns with the same friendlyName', async () => {
      const firstTown = await createTownForTesting();
      const secondTown = await createTownForTesting(firstTown.friendlyName);
      expect(firstTown.coveyTownID)
        .not
        .toBe(secondTown.coveyTownID);
    });
    it('Prohibits a blank friendlyName', async () => {
      try {
        await createTownForTesting('');
        fail('createTown should throw an error if friendly name is empty string');
      } catch (err) {
        // OK
      }
    });
  });

  describe('CoveyTownListAPI', () => {
    it('Lists public towns, but not private towns', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(undefined, false);
      const pubTown2 = await createTownForTesting(undefined, true);
      const privTown2 = await createTownForTesting(undefined, false);

      const towns = await apiClient.listTowns();
      expectTownListMatches(towns, pubTown1);
      expectTownListMatches(towns, pubTown2);
      expectTownListMatches(towns, privTown1);
      expectTownListMatches(towns, privTown2);

    });
    it('Allows for multiple towns with the same friendlyName', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(pubTown1.friendlyName, false);
      const pubTown2 = await createTownForTesting(pubTown1.friendlyName, true);
      const privTown2 = await createTownForTesting(pubTown1.friendlyName, false);

      const towns = await apiClient.listTowns();
      expectTownListMatches(towns, pubTown1);
      expectTownListMatches(towns, pubTown2);
      expectTownListMatches(towns, privTown1);
      expectTownListMatches(towns, privTown2);
    });
  });

  describe('CoveyTownDeleteAPI', () => {
    it('Throws an error if the password is invalid', async () => {
      const {coveyTownID} = await createTownForTesting(undefined, true);
      try {
        await apiClient.deleteTown({
          coveyTownID,
          coveyTownPassword: nanoid(),
        });
        fail('Expected deleteTown to throw an error');
      } catch (e) {
        // Expected error
      }
    });
    it('Throws an error if the townID is invalid', async () => {
      const {townUpdatePassword} = await createTownForTesting(undefined, true);
      try {
        await apiClient.deleteTown({
          coveyTownID: nanoid(),
          coveyTownPassword: townUpdatePassword,
        });
        fail('Expected deleteTown to throw an error');
      } catch (e) {
        // Expected error
      }
    });
    it('Deletes a town and its channel if given a valid password and town, no longer allowing it to be joined or listed', async () => {
      const {coveyTownID, townUpdatePassword} = await createTownForTesting(undefined, true);
      await apiClient.deleteTown({
        coveyTownID,
        coveyTownPassword: townUpdatePassword,
      });
      try {
        await apiClient.joinTown({
          userName: nanoid(),
          coveyTownID,
        });
        fail('Expected joinTown to throw an error');
      } catch (e) {
        // Expected
      }
      const listedTowns = await apiClient.listTowns();
      if (listedTowns.towns.find(r => r.coveyTownID === coveyTownID)) {
        fail('Expected the deleted town to no longer be listed');
      }
      expect(mockDeleteChannel).toHaveBeenCalled();
    });
  });
  describe('CoveyTownUpdateAPI', () => {
    it('Checks the password before updating any values', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      try {
        await apiClient.updateTown({
          coveyTownID: pubTown1.coveyTownID,
          coveyTownPassword: `${pubTown1.townUpdatePassword}*`,
          friendlyName: 'broken',
          isPubliclyListed: false,
        });
        fail('updateTown with an invalid password should throw an error');
      } catch (err) {
        // err expected
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }

      // Make sure name or vis didn't change
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
    });
    it('Updates the friendlyName and visbility as requested', async () => {

      const mockSid = nanoid();
      mockCreateChannel.mockReturnValue(Promise.resolve({
        sid: mockSid,
      }));
      const pubTown1 = await createTownForTesting(undefined, false);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      const mockResponse = {
        sid: nanoid(),
        friendlyName: 'newName',
      };

      mockUpdateChannel.mockReturnValue(mockResponse);

      await apiClient.updateTown({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        friendlyName: 'newName',
        isPubliclyListed: true,
      });
      pubTown1.friendlyName = 'newName';
      pubTown1.isPubliclyListed = true;
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      expect(mockUpdateChannel).toHaveBeenCalledWith(mockSid, 'newName');
    });
    it('Does not update the visibility if visibility is undefined', async () => {
      const pubTown1 = await createTownForTesting(undefined, true);
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
      mockUpdateChannel.mockReturnValue({
        sid: nanoid(),
        friendlyName: 'newName2',
      });
      await apiClient.updateTown({
        coveyTownID: pubTown1.coveyTownID,
        coveyTownPassword: pubTown1.townUpdatePassword,
        friendlyName: 'newName2',
      });
      pubTown1.friendlyName = 'newName2';
      expectTownListMatches(await apiClient.listTowns(), pubTown1);
    });
  });

  describe('CoveyMemberAPI', () => {
    it('Throws an error if the town does not exist', async () => {
      await createTownForTesting(undefined, true);
      try {
        await apiClient.joinTown({
          userName: nanoid(),
          coveyTownID: nanoid(),
        });
        fail('Expected an error to be thrown by joinTown but none thrown');
      } catch (err) {
        // OK, expected an error
        // TODO this should really check to make sure it's the *right* error, but we didn't specify
        // the format of the exception :(
      }
    });
    it('Admits a user to a valid public or private town', async () => {
      mockGetChatTokenForTown.mockReturnValue(Promise.resolve(nanoid()));
      const pubTown1 = await createTownForTesting(undefined, true);
      const privTown1 = await createTownForTesting(undefined, false);
      const res = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: pubTown1.coveyTownID,
      });
      expect(res.coveySessionToken)
        .toBeDefined();
      expect(res.coveyUserID)
        .toBeDefined();

      const res2 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: privTown1.coveyTownID,
      });
      expect(res2.coveySessionToken)
        .toBeDefined();
      expect(res2.coveyUserID)
        .toBeDefined();

    });
  });
  describe('CoveyTownChat Private Chat', () => {
    let mockUniqueName: string;
    beforeEach(() => {
      mockCreateChannel.mockReset();
      mockSendInvite.mockReset();
      mockGetChatTokenForTown.mockReset();

      mockUniqueName = nanoid();
      mockCreateChannel.mockReturnValue(Promise.resolve({
        sid: nanoid(),
        uniqueName: mockUniqueName,
      }));
      mockGetChatTokenForTown.mockReturnValue(Promise.resolve(nanoid()));
    });
    it('Should create a new private chat channel', async () => {
      const mockResponse = {
        uniqueName: mockUniqueName,
      };

      const testTown = await createTownForTesting(undefined, true);

      const res1 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: testTown.coveyTownID,
      });

      const res2 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: testTown.coveyTownID,
      });

      const response = await apiClient.createPrivateChatChannel({
        currentPlayerID: res1.coveyUserID,
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: res2.coveyUserID,
      });

      // Create a channel for the public town and another for the private messaging channel
      expect(mockCreateChannel).toBeCalledTimes(2);
      expect(response).toStrictEqual(mockResponse);
    });
    it('Should not create a new private chat channel if both playerIDs are empty', async () => {
      const testTown = await createTownForTesting(undefined, true);

      // Both playerIDs are empty strings
      await expect(apiClient.createPrivateChatChannel({
        currentPlayerID: '',
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: '',
      })).rejects.toThrow('Usernames cannot be empty');

      // The current playerID is empty
      await expect(apiClient.createPrivateChatChannel({
        currentPlayerID: '',
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: nanoid(),
      })).rejects.toThrow('Usernames cannot be empty');

      // The other playerID is empty
      await expect(apiClient.createPrivateChatChannel({
        currentPlayerID: nanoid(),
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: '',
      })).rejects.toThrow('Usernames cannot be empty');
    });
    it('Should not create a new private chat channel if both playerIDs are not in the same town', async () => {
      const testTown = await createTownForTesting(undefined, true);

      await expect(apiClient.createPrivateChatChannel({
        currentPlayerID: nanoid(),
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: nanoid(),
      })).rejects.toThrow('Error processing request: Both players are not in the room');
    });
    it('Should not create a new private chat channel if there is already one existing between both players', async () => {

      const testTown = await createTownForTesting(undefined, true);

      const currentUserName = nanoid();
      const otherUserName = nanoid();
      const res1 = await apiClient.joinTown({
        userName: currentUserName,
        coveyTownID: testTown.coveyTownID,
      });

      const res2 = await apiClient.joinTown({
        userName: otherUserName,
        coveyTownID: testTown.coveyTownID,
      });

      const friendlyName = {
        players: {
          currentPlayer: {
            playerID: res1.coveyUserID,
            userName: currentUserName,
          },
          otherPlayer: {
            playerID: res2.coveyUserID,
            userName: otherUserName,
          },
        },
      };

      // Mock the return value for creating a private chat.
      mockCreateChannel.mockReturnValueOnce(Promise.resolve({
        sid: nanoid(),
        friendlyName: JSON.stringify(friendlyName),
        uniqueName: nanoid(),
      }));

      const firstResponse = await apiClient.createPrivateChatChannel({
        currentPlayerID: res1.coveyUserID,
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: res2.coveyUserID,
      });

      const secondResponse = await apiClient.createPrivateChatChannel({
        currentPlayerID: res1.coveyUserID,
        coveyTownID: testTown.coveyTownID,
        otherPlayerID: res2.coveyUserID,
      });

      // The second response should just return the uniqueName of the already existing channel.
      expect(firstResponse).toStrictEqual(secondResponse);

      // Two channels created. One from creating the public chat and another for creating a single
      // private chat channel.
      expect(mockCreateChannel).toBeCalledTimes(2);

      // Sends invites to both players when the channel is created and twice more if there is
      // a duplicate
      expect(mockSendInvite).toBeCalledTimes(4);

    });
  });
  describe('CoveyTownChat Help Chat', () => {
    let mockUniqueName: string;
    beforeEach(() => {
      mockCreateChannel.mockReset();
      mockSendInvite.mockReset();
      mockGetChatTokenForTown.mockReset();
      mockCreateChannelWithBot.mockReset();

      mockUniqueName = nanoid();
      mockCreateChannel.mockReturnValue(Promise.resolve({
        sid: nanoid(),
        uniqueName: mockUniqueName,
      }));
      mockCreateChannelWithBot.mockReturnValue(Promise.resolve({
        uniqueName: mockUniqueName,
      }));

      mockGetChatTokenForTown.mockReturnValue(Promise.resolve(nanoid()));
    });
    it('Should create a private chat channel with a bot', async () => {

      const mockResponse = {
        uniqueName: mockUniqueName,
      };

      const testTown = await createTownForTesting(nanoid(), true);

      const res1 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: testTown.coveyTownID,
      });

      const response = await apiClient.createChatBotChannel({
        coveyTownID: testTown.coveyTownID,
        playerID: res1.coveyUserID,
      });

      expect(mockSendInvite).toHaveBeenCalledTimes(1);
      expect(response).toStrictEqual(mockResponse);
    });
    it('Should should reuse an existing private chat channel with a bot', async () => {

      const mockResponse = {
        uniqueName: mockUniqueName,
      };

      const testTown = await createTownForTesting(nanoid(), true);

      const res1 = await apiClient.joinTown({
        userName: nanoid(),
        coveyTownID: testTown.coveyTownID,
      });

      const firstResponse = await apiClient.createChatBotChannel({
        coveyTownID: testTown.coveyTownID,
        playerID: res1.coveyUserID,
      });

      const secondResponse = await apiClient.createChatBotChannel({
        coveyTownID: testTown.coveyTownID,
        playerID: res1.coveyUserID,
      });

      // The second response should just return the uniqueName of the already existing channel.
      expect(firstResponse).toStrictEqual(secondResponse);

      expect(mockSendInvite).toHaveBeenCalledTimes(2);

      expect(mockCreateChannelWithBot).toHaveBeenCalledTimes(2);
    });
  });
});
