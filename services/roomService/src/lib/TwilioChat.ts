import dotenv from 'dotenv';
import Twilio from 'twilio';
import assert from 'assert';
import {ChannelInstance} from 'twilio/lib/rest/chat/v2/service/channel';
import {InviteContext} from 'twilio/lib/rest/chat/v2/service/channel/invite';
import IChatClient from './IChatClient';

dotenv.config();

// 1 hour: each client will time out after 1 hour of video and need to refresh
const MAX_ALLOWED_SESSION_DURATION = 3600;

export default class TwilioChat implements IChatClient {
  private _twilioClient: Twilio.Twilio;

  private static _instance: TwilioChat;

  private _twilioAccountSid: string;

  private _twilioApiKeySID: string;

  private _twilioApiKeySecret: string;

  private _twilioChatServiceSID: string;

  private _twilioAutopilotURL: string;

  constructor(twilioAccountSid: string,
    twilioAuthToken: string,
    twilioAPIKeySID: string,
    twilioAPIKeySecret: string,
    twilioChatServiceSID: string,
    twilioAutopilotURL: string,
  ) {
    this._twilioAccountSid = twilioAccountSid;
    this._twilioApiKeySID = twilioAPIKeySID;
    this._twilioApiKeySecret = twilioAPIKeySecret;
    this._twilioChatServiceSID = twilioChatServiceSID;
    this._twilioAutopilotURL = twilioAutopilotURL;
    this._twilioClient = Twilio(twilioAccountSid, twilioAuthToken);
  }

  public static getInstance(): TwilioChat {
    if (!TwilioChat._instance) {
      assert(process.env.TWILIO_API_AUTH_TOKEN,
        'Environmental variable TWILIO_API_AUTH_TOKEN must be set');
      assert(process.env.TWILIO_ACCOUNT_SID,
        'Environmental variable TWILIO_ACCOUNT_SID must be set');
      assert(process.env.TWILIO_API_KEY_SID,
        'Environmental variable TWILIO_API_KEY_SID must be set');
      assert(process.env.TWILIO_API_KEY_SECRET,
        'Environmental variable TWILIO_API_KEY_SECRET must be set');
      assert(process.env.TWILIO_CHAT_SERVICE_SID,
        'Environmental variable TWILIO_CHAT_SERVICE_SID must be set');
      assert(process.env.TWILIO_AUTOPILOT_URL,
        'Environmental variable TWILIO_AUTOPILOT_URL must be set');
      TwilioChat._instance = new TwilioChat(
        process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_API_AUTH_TOKEN,
        process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET,
        process.env.TWILIO_CHAT_SERVICE_SID, process.env.TWILIO_AUTOPILOT_URL,
      );
    }
    return TwilioChat._instance;
  }

  /**
   * Authorizes a user connecting to the chat
   */
  async getToken(playerID: string, userName: string): Promise<string> {
    const identity = {
      playerID,
      userName,
    };

    const token = new Twilio.jwt.AccessToken(
      this._twilioAccountSid, this._twilioApiKeySID, this._twilioApiKeySecret, {
        ttl: MAX_ALLOWED_SESSION_DURATION,
        identity: JSON.stringify(identity),
      },
    );
    const chatGrant = new Twilio.jwt.AccessToken.ChatGrant({serviceSid: process.env.TWILIO_CHAT_SERVICE_SID});

    token.addGrant(chatGrant);

    return token.toJwt();
  }

  async createChannel(friendlyName: string, uniqueName: string): Promise<ChannelInstance> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels
      .create({friendlyName, uniqueName});

    await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .update({
        webhookMethod: '',
        postWebhookUrl: '',
      });
    return response;
  }

  async updateChannel(channelSID: string, updatedChannelName: string): Promise<ChannelInstance> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels(channelSID)
      .update({
        friendlyName: updatedChannelName,
      });
    return response;
  }

  async deleteChannel(channelSID: string): Promise<boolean> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels(channelSID)
      .remove();
    return response;
  }

  async getChannels(): Promise<ChannelInstance[]> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels
      .list();
    return response;
  }

  async sendInvite(channelSID: string, identity: string): Promise<InviteContext> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels(channelSID)
      .invites
      .create({
        identity,
      })
    ;
    return response;
  }

  async createChannelWithBot(friendlyName: string, uniqueName: string): Promise<ChannelInstance> {
    const response = await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels
      .create({friendlyName, uniqueName, type:'private' });

    await this._twilioClient.chat.services(this._twilioChatServiceSID)
      .channels(response.sid)
      .webhooks
      .create({
        type: 'webhook',
        configuration: {
          filters: ['onMessageSent'],
          method: 'POST',
          url: this._twilioAutopilotURL,
        },
      });
    return response;
  }
}
