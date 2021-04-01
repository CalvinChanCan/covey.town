import {nanoid} from 'nanoid';
import {mock, mockReset} from 'jest-mock-extended';
import {Socket} from 'socket.io';
import {ChannelInstance} from 'twilio/lib/rest/chat/v2/service/channel';
import {InviteContext} from 'twilio/lib/rest/chat/v2/service/channel/invite';
import { assert } from 'console';
import Client from 'twilio-chat';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import {UserLocation} from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';
import {townSubscriptionHandler} from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';
import TwilioChat from './TwilioChat';


// controller test : destroy session should clean up channels
// town controller object should have a channel associated with it with a sid (from ChannelInstance)
// mock twilio response
const twilioChat = TwilioChat.getInstance();


describe('TwilioChat', ()=>{
  let friendlyName : string;
  let uniqueName : string;
  let response : ChannelInstance;
  beforeEach(async ()=>{
    friendlyName = nanoid();
    uniqueName = nanoid();
    response = await twilioChat.createChannel(friendlyName, uniqueName);
  });
  afterAll(async ()=>{
    const channels = await twilioChat.getChannels();
    channels.forEach(async channel=>{
      await twilioChat.deleteChannel(channel.sid);
    });
  });
  
  describe('Create Channel', ()=>{
    it('Test that it connects to TwilioChat API and friendlyName and uniqueName are expected, sid is defined.', async ()=>{
      assert(response);
      expect(response.friendlyName).toBe(friendlyName);
      expect(response.uniqueName).toBe(uniqueName);
      expect(response.sid).toBeDefined();
    });
  });

  describe('Update Channel', ()=>{
    it('Test that updated name is as expected, uniqueName remains the same.', async ()=>{
      const friendlyName2 = nanoid();
      const responseUpdate = await twilioChat.updateChannel(response.sid, friendlyName2);
      expect(responseUpdate.friendlyName).toBe(friendlyName2);
      expect(responseUpdate.uniqueName).toBe(uniqueName);
    });
  });

  describe('Delete Channel', ()=>{
    it('Test that response returns true', async ()=>{
      const deleteResponse = await twilioChat.deleteChannel(response.sid);
      expect(deleteResponse).toBe(true);
    });
  });

  describe('Get Channels', ()=>{
    it('Test that created channel is in list', async ()=>{
      const responseGetChannels = await twilioChat.getChannels();
      expect(responseGetChannels.find(channel => channel.sid === response.sid)).toStrictEqual(response);
      // expect(foundChannelInstance.sid).toBe(response.sid);
    });
  });

  describe('Send Invite', ()=>{
    it('Test that invite sends', async ()=>{
      const playerID = nanoid();
      const userName = nanoid();
      const token = await twilioChat.getToken(playerID, userName);
      const identity = {
        playerID,
        userName,
      };
      await Client.create(token);
      const responseInvite : InviteContext = (await twilioChat.sendInvite(response.sid, JSON.stringify(identity)));

      const invite = await responseInvite.toJSON();
      expect(invite.channelSid).toBe(response.sid);
      const responseInviteJSON = JSON.parse(invite.identity);
      expect(responseInviteJSON.playerID).toBe(identity.playerID);
      expect(responseInviteJSON.userName).toBe(identity.userName);
      
    });
  });

});