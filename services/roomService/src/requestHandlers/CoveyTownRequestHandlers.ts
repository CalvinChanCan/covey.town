import assert from 'assert';
import { Socket } from 'socket.io';
import {nanoid} from 'nanoid';
import Player from '../types/Player';
import { CoveyTownList, UserLocation } from '../CoveyTypes';
import CoveyTownListener from '../types/CoveyTownListener';
import CoveyTownsStore from '../lib/CoveyTownsStore';
import TwilioChat from '../lib/TwilioChat';

/**
 * The format of a request to join a Town in Covey.Town, as dispatched by the server middleware
 */
export interface TownJoinRequest {
  /** userName of the player that would like to join * */
  userName: string;
  /** ID of the town that the player would like to join * */
  coveyTownID: string;
}

/**
 * The format of a response to join a Town in Covey.Town, as returned by the handler to the server
 * middleware
 */
export interface TownJoinResponse {
  /** Unique ID that represents this player * */
  coveyUserID: string;
  /** Secret token that this player should use to authenticate
   * in future requests to this service * */
  coveySessionToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the video service * */
  providerVideoToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the chat service * */
  providerChatToken: string;
  /** List of players currently in this town * */
  currentPlayers: Player[];
  /** Friendly name of this town * */
  friendlyName: string;
  /** Is this a private town? * */
  isPubliclyListed: boolean;
}

/**
 * Payload sent by client to create a Town in Covey.Town
 */
export interface TownCreateRequest {
  friendlyName: string;
  isPubliclyListed: boolean;
}

/**
 * Response from the server for a Town create request
 */
export interface TownCreateResponse {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Response from the server for a Town list request
 */
export interface TownListResponse {
  towns: CoveyTownList;
}

/**
 * Payload sent by the client to delete a Town
 */
export interface TownDeleteRequest {
  coveyTownID: string;
  coveyTownPassword: string;
}

/**
 * Payload sent by the client to update a Town.
 * N.B., JavaScript is terrible, so:
 * if(!isPubliclyListed) -> evaluates to true if the value is false OR undefined, use ===
 */
export interface TownUpdateRequest {
  coveyTownID: string;
  coveyTownPassword: string;
  friendlyName?: string;
  isPubliclyListed?: boolean;
}


/**
 * Payload sent by client to create a private chat in Covey.Town
 */
export interface ChatCreateRequest {
  currentPlayerID: string;
  otherPlayerID: string;
  coveyTownID: string;
}

/**
 * Response from the server for a private chat create request
 */
export interface ChatCreateResponse {
  uniqueName: string;
}

/**
 * Payload sent by client to create a private chat in Covey.Town
 */
export interface ChatBotCreateRequest {
  playerID: string;
  coveyTownID: string;
}

/**
 * Response from the server for a private chat create request
 */
export interface ChatBotCreateResponse {
  uniqueName: string;
}


/**
 * Envelope that wraps any response from the server
 */
export interface ResponseEnvelope<T> {
  isOK: boolean;
  message?: string;
  response?: T;
}

/**
 * A handler to process a player's request to join a town. The flow is:
 *  1. Client makes a TownJoinRequest, this handler is executed
 *  2. Client uses the sessionToken returned by this handler to make a subscription to the town,
 *  @see townSubscriptionHandler for the code that handles that request.
 *
 * @param requestData an object representing the player's request
 */
export async function townJoinHandler(requestData: TownJoinRequest): Promise<ResponseEnvelope<TownJoinResponse>> {
  const townsStore = CoveyTownsStore.getInstance();

  const coveyTownController = townsStore.getControllerForTown(requestData.coveyTownID);
  if (!coveyTownController) {
    return {
      isOK: false,
      message: 'Error: No such town',
    };
  }
  const newPlayer = new Player(requestData.userName);
  const newSession = await coveyTownController.addPlayer(newPlayer);
  assert(newSession.videoToken);
  assert(newSession.chatToken);
  return {
    isOK: true,
    response: {
      coveyUserID: newPlayer.id,
      coveySessionToken: newSession.sessionToken,
      providerVideoToken: newSession.videoToken,
      providerChatToken: newSession.chatToken,
      currentPlayers: coveyTownController.players,
      friendlyName: coveyTownController.friendlyName,
      isPubliclyListed: coveyTownController.isPubliclyListed,
    },
  };
}

export async function townListHandler(): Promise<ResponseEnvelope<TownListResponse>> {
  const townsStore = CoveyTownsStore.getInstance();
  return {
    isOK: true,
    response: { towns: townsStore.getTowns() },
  };
}

export async function townCreateHandler(requestData: TownCreateRequest): Promise<ResponseEnvelope<TownCreateResponse>> {
  const townsStore = CoveyTownsStore.getInstance();
  if (requestData.friendlyName.length === 0) {
    return {
      isOK: false,
      message: 'FriendlyName must be specified',
    };
  }

  const newTown = townsStore.createTown(requestData.friendlyName, requestData.isPubliclyListed);
  const response = await TwilioChat.getInstance().createChannel(requestData.friendlyName, newTown.coveyTownID);
  newTown.channelID = response.sid;

  return {
    isOK: true,
    response: {
      coveyTownID: newTown.coveyTownID,
      coveyTownPassword: newTown.townUpdatePassword,
    },
  };
}

export async function townDeleteHandler(requestData: TownDeleteRequest): Promise<ResponseEnvelope<Record<string, null>>> {
  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.deleteTown(requestData.coveyTownID, requestData.coveyTownPassword);
  if (success) {
    const channelID = townsStore.getControllerForTown(requestData.coveyTownID)?.channelID;
    if (channelID) {
      await TwilioChat.getInstance().deleteChannel(channelID);
    }
  }
  return {
    isOK: success,
    response: {},
    message: !success ? 'Invalid password. Please double check your town update password.' : undefined,
  };
}

export async function townUpdateHandler(requestData: TownUpdateRequest): Promise<ResponseEnvelope<Record<string, null>>> {
  const townsStore = CoveyTownsStore.getInstance();
  const success = townsStore.updateTown(requestData.coveyTownID, requestData.coveyTownPassword, requestData.friendlyName, requestData.isPubliclyListed);

  if (success) {
    const channelID = townsStore.getControllerForTown(requestData.coveyTownID)?.channelID;
    if (channelID && requestData.friendlyName) {
      await TwilioChat.getInstance().updateChannel(channelID, requestData.friendlyName);
    }
  }

  return {
    isOK: success,
    response: {},
    message: !success ? 'Invalid password or update values specified. Please double check your town update password.' : undefined,
  };

}

export async function privateChatCreateHandler(requestData: ChatCreateRequest): Promise<ResponseEnvelope<ChatCreateResponse>> {

  if (requestData.currentPlayerID.length === 0 || requestData.otherPlayerID.length === 0) {
    return {
      isOK: false,
      message: 'Usernames cannot be empty',
    };
  }

  const controller = CoveyTownsStore.getInstance().getControllerForTown(requestData.coveyTownID);
  if (controller) {
    const currentPlayer = controller.players.find(player => player.id === requestData.currentPlayerID);
    const otherPlayer = controller.players.find(player => player.id === requestData.otherPlayerID);

    // Verify that both players actually exist in the room.
    if (currentPlayer && otherPlayer) {
      const friendlyName = {
        players: {
          currentPlayer: {
            playerID: currentPlayer.id,
            userName: currentPlayer.userName,
          },
          otherPlayer: {
            playerID: otherPlayer.id,
            userName: otherPlayer.userName,
          },
        },
      };

      const channels = controller.getPrivateChannels();

      const duplicate = channels.find((channel) => {
        const { players } = JSON.parse(channel.friendlyName);

        return players.currentPlayer.playerID === currentPlayer.id && players.otherPlayer.playerID === otherPlayer.id ||
          players.currentPlayer.playerID === otherPlayer.id && players.otherPlayer.playerID === currentPlayer.id;
      });

      if (duplicate){

        const identity1 = {
          playerID: currentPlayer.id,
          userName: currentPlayer.userName,
        };

        const identity2 = {
          playerID: otherPlayer.id,
          userName: otherPlayer.userName,
        };

        await TwilioChat.getInstance().sendInvite(duplicate.sid, JSON.stringify(identity1));
        await TwilioChat.getInstance().sendInvite(duplicate.sid, JSON.stringify(identity2));

        return {
          isOK: true,
          message: 'Private channel already exists',
          response: {
            uniqueName: duplicate.uniqueName,
          },
        };
      }

      const response = await TwilioChat.getInstance().createChannel(JSON.stringify(friendlyName), nanoid(5));
      controller.addPrivateChannel(response);

      const identity1 = {
        playerID: currentPlayer.id,
        userName: currentPlayer.userName,
      };

      const identity2 = {
        playerID: otherPlayer.id,
        userName: otherPlayer.userName,
      };

      await TwilioChat.getInstance().sendInvite(response.sid, JSON.stringify(identity1));
      await TwilioChat.getInstance().sendInvite(response.sid, JSON.stringify(identity2));

      return {
        isOK: true,
        response: {
          uniqueName: response.uniqueName,
        },
      };
    }
    return {
      isOK: false,
      message: 'Both players are not in the room',
    };

  }
  return {
    isOK: false,
    message: 'Room does not exist',
  };
}

export async function ChatBotCreateHandler(requestData: ChatBotCreateRequest): Promise<ResponseEnvelope<ChatBotCreateResponse>> {

  if (requestData.playerID.length === 0) {
    return {
      isOK: false,
      message: 'Username cannot be empty',
    };
  }

  const controller = CoveyTownsStore.getInstance().getControllerForTown(requestData.coveyTownID);
  if (controller) {

    const channels = controller.getHelpChannels();
    const targetPlayer = controller.players.find(player => player.id === requestData.playerID);


    if (targetPlayer) {
      const duplicate = channels.find((channel) => channel.friendlyName === targetPlayer.id);
      const identity = {
        playerID: targetPlayer.id,
        userName: targetPlayer.userName,
      };

      if (duplicate){
        try {
          await TwilioChat.getInstance().sendInvite(duplicate.sid, JSON.stringify(identity));
          return {
            isOK: true,
            message: 'Help channel already exists for the player',
            response: {
              uniqueName: duplicate.uniqueName,
            },
          };
        } catch (e) {
          return {
            isOK: true,
            message: 'Player has already been invited!',
            response: {
              uniqueName: duplicate.uniqueName,
            },
          };
        }
      }

      const response = await TwilioChat.getInstance().createChannelWithBot(targetPlayer.id, nanoid(5));
      controller.addHelpChannel(response);

      await TwilioChat.getInstance().sendInvite(response.sid, JSON.stringify(identity));
      return {
        isOK: true,
        response: {
          uniqueName: response.uniqueName,
        },
      };
    }
    return {
      isOK: false,
      message: 'The player is not in the room',
    };

  }
  return {
    isOK: false,
    message: 'Room does not exist',
  };
}

/**
 * An adapter between CoveyTownController's event interface (CoveyTownListener)
 * and the low-level network communication protocol
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
function townSocketAdapter(socket: Socket): CoveyTownListener {
  return {
    onPlayerMoved(movedPlayer: Player) {
      socket.emit('playerMoved', movedPlayer);
    },
    onPlayerDisconnected(removedPlayer: Player) {
      socket.emit('playerDisconnect', removedPlayer);
    },
    onPlayerJoined(newPlayer: Player) {
      socket.emit('newPlayer', newPlayer);
    },
    onTownDestroyed() {
      socket.emit('townClosing');
      socket.disconnect(true);
    },
  };
}

/**
 * A handler to process a remote player's subscription to updates for a town
 *
 * @param socket the Socket object that we will use to communicate with the player
 */
export function townSubscriptionHandler(socket: Socket): void {
  // Parse the client's session token from the connection
  // For each player, the session token should be the same string returned by joinTownHandler
  const { token, coveyTownID } = socket.handshake.auth as { token: string; coveyTownID: string };

  const townController = CoveyTownsStore.getInstance()
    .getControllerForTown(coveyTownID);

  // Retrieve our metadata about this player from the TownController
  const s = townController?.getSessionByToken(token);
  if (!s || !townController) {
    // No valid session exists for this token, hence this client's connection should be terminated
    socket.disconnect(true);
    return;
  }

  // Create an adapter that will translate events from the CoveyTownController into
  // events that the socket protocol knows about
  const listener = townSocketAdapter(socket);
  townController.addTownListener(listener);

  // Register an event listener for the client socket: if the client disconnects,
  // clean up our listener adapter, and then let the CoveyTownController know that the
  // player's session is disconnected
  socket.on('disconnect', () => {
    townController.removeTownListener(listener);
    townController.destroySession(s);
  });

  // Register an event listener for the client socket: if the client updates their
  // location, inform the CoveyTownController
  socket.on('playerMovement', (movementData: UserLocation) => {
    townController.updatePlayerLocation(s.player, movementData);
  });
}
