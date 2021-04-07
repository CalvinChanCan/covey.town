/**
 * The chat calling component of Covey.Town must implement this server interface,
 * which is used to authorize a client to connect to a chat channels.
 */
export default interface IChatClient {
  /**
   * Issue a secret token on behalf of the chat service that to connect the client to our chat service
   *
   * @param playerID the covey town generated playerID for a specific player
   * @param userName the username of the player when they entered a town
   */
  getToken(playerID: string, userName: string): Promise<string>;

}
