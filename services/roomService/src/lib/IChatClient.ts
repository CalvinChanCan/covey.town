/**
 * The video calling component of Covey.Town must implement this server interface,
 * which is used to authorize a client to connect to a video room.
 */
export default interface IChatClient {
  /**
   * Issue a secret token on behalf of the video service that the client will be able to use
   * to connect to the video room specified.
   *
   * @param playerID
   * @param userName
   */
  getToken(playerID: string, userName: string): Promise<string>;

  deleteChannel(channelSID: string): Promise<boolean>;
}
