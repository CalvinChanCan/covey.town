import {nanoid} from 'nanoid';
import {mock} from 'jest-mock-extended';
import {ChannelInstance} from 'twilio/lib/rest/chat/v2/service/channel';
import {assert} from 'console';
import TwilioChat from './TwilioChat';


// controller test : destroy session should clean up channels
// town controller object should have a channel associated with it with a sid (from ChannelInstance)
// mock twilio response
const twilioChat = TwilioChat.getInstance();


describe('TwilioChat', () => {
  let friendlyName: string;
  let uniqueName: string;
  let response: ChannelInstance;
  beforeEach(async () => {
    friendlyName = nanoid();
    uniqueName = nanoid();
    response = await twilioChat.createChannel(friendlyName, uniqueName);
  });
  afterAll(async () => {
    const channels = await twilioChat.getChannels();
    channels.forEach(async channel => {
      await twilioChat.deleteChannel(channel.sid);
    });
  });
  describe('Create Channel', () => {
    it('Test that it connects to TwilioChat API and friendlyName and uniqueName are expected, sid is defined.', async () => {
      assert(response);
      expect(response.friendlyName).toBe(friendlyName);
      expect(response.uniqueName).toBe(uniqueName);
      expect(response.sid).toBeDefined();
    });
  });

  describe('Update Channel', () => {
    it('Test that updated name is as expected, uniqueName remains the same.', async () => {
      const friendlyName2 = nanoid();
      const responseUpdate = await twilioChat.updateChannel(response.sid, friendlyName2);
      expect(responseUpdate.friendlyName).toBe(friendlyName2);
      expect(responseUpdate.uniqueName).toBe(uniqueName);
    });
  });

  describe('Delete Channel', () => {
    it('Test that response returns true', async () => {
      const deleteResponse = await twilioChat.deleteChannel(response.sid);
      expect(deleteResponse).toBe(true);
    });
  });

  describe('Get Channels', () => {
    it('Test that created channel is in list', async () => {
      const responseGetChannels = await twilioChat.getChannels();
      expect(responseGetChannels.find(channel => channel.sid === response.sid)).toStrictEqual(response);
      // expect(foundChannelInstance.sid).toBe(response.sid);
    });
  });

  describe('Send Invite', () => {
    it('Test that invite sends', async () => {
      const playerID = nanoid();
      const userName = nanoid();
      const identity = {
        playerID,
        userName,
      };

      const mockTwilioChat = mock<TwilioChat>();
      const mockResponse = {
        accountSid: nanoid(),
        channelSid: nanoid(),
        createdBy: nanoid(),
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
      mockTwilioChat.sendInvite.mockReturnValue(Promise.resolve(mockResponse));
      const inviteResponse = await mockTwilioChat.sendInvite(response.sid, JSON.stringify(identity));

      expect(inviteResponse).toBe(mockResponse);
      expect(mockTwilioChat.sendInvite).toBeCalledWith(response.sid, JSON.stringify(identity));
      expect(mockTwilioChat.sendInvite).toBeCalledTimes(1);
    });
  });

});

describe('Create Channel With Bot', () => {
  it('Test channel exists', async () => {
    const friendlyName = nanoid();
    const uniqueName = nanoid();
    const response = await twilioChat.createChannelWithBot(friendlyName, uniqueName);
    assert(response);
    expect(response.friendlyName).toBe(friendlyName);
    expect(response.uniqueName).toBe(uniqueName);
    expect(response.sid).toBeDefined();
  });
});
