import {nanoid} from 'nanoid';
import {mock, mockReset} from 'jest-mock-extended';
import {Socket} from 'socket.io';
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


describe('TwilioChat', ()=>{
  
  describe('Create Channel', ()=>{
    it('Test that it connects to TwilioChat API', ()=>{
      // want to test that it fails, test that it passes
      // test that fails when passed a repeated uniqueID
      // check that channels created are different even with same player names?
    });
  });

  it('test', ()=>{
    // some test here
  });

});