import React, {useCallback, useEffect, useState} from 'react';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {
  Button, Tabs, Tab, TabList, TabPanels, TabPanel, Menu,
  MenuButton, MenuList, MenuOptionGroup, MenuItemOption, useToast, CloseButton
} from "@chakra-ui/react";


// for saving the files
import { saveAs } from 'file-saver';

import useCoveyAppState from "../../hooks/useCoveyAppState";
import ChatScreen from "./ChatScreen";
import Player from "../../classes/Player";
import useNearbyPlayers from "../../hooks/useNearbyPlayers";

/**
 * ChannelWrapper manages channels. It takes in the chat token to generate a client,
 * which is used for channel management.
 * @param chatToken the token used to create the Chat Client
 * @returns A React Component that displays the full chat window
 */
export default function ChannelWrapper({chatToken}: { chatToken: string }): JSX.Element {
  const [client, setClient] = useState<Client>();
  const [loading, setLoading] = useState<boolean>(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const {currentTownID, currentTownFriendlyName, userName, players, myPlayerID, apiClient} = useCoveyAppState();

  const [privateChannels, setPrivateChannels] = useState<string[]>([]);
  const toast = useToast();

  const handleTabsChange = useCallback((index) => {
    setTabIndex(index)
  },[]);

  // checks if channel already exists, then adds to channels array if not already exists.
  const addChannel = useCallback((newChannel: Channel) => {
    const exists = channels.find(each => each.uniqueName === newChannel.uniqueName);
    if (!exists) {
      setChannels(old => [...old, newChannel]);
    }
  },[channels]);

  // Handler for channel events
  const handleChannelEvents = useCallback(async(channelClient : Client)=>{
      channelClient.on('channelJoined', async (joinedChannel: Channel) => {
        console.log(`chat client channelJoined event on ${joinedChannel.friendlyName} has occurred`);
      });

      channelClient.on('channelInvited', async (channel: Channel) => {
        console.log(`Invited to channel ${channel.friendlyName}`); // can become toast as user indicator
        // Join the channel that you were invited to
        await channel.join();
        await channel.sendMessage(`${userName} joined the chat`);
        const getFirstMessage = await channel.getMessages();

        // Relies on the idea that the first message comes from the inviting user!
        setPrivateChannels(oldUsers =>[...oldUsers, JSON.parse(getFirstMessage.items[0].author).playerID]);
        setChannels(oldChannels =>[...oldChannels, channel])
      });
  },[userName]);

  const createPrivateChannelWithBot = async () => {
    await apiClient.createChatBotChannel({
      playerID: myPlayerID,
      coveyTownID: currentTownID,
    })
    setTabIndex(channels.length)
  };


  // Get client object on mount.
  useEffect(() => {
    let isMounted = true;
    const logIn = async () => {
      setLoading(true);
      try {

        const newClient = await Client.create(chatToken);
        if (isMounted) {
          setClient(newClient);
        }
        setLoading(false);
      } catch (error) {
        throw new Error(`Unable to create client for ${currentTownFriendlyName}: \n${error}`);
      }
    };
    logIn();
    return () => {
      isMounted = false
    };

  }, [chatToken, currentTownFriendlyName]);

  const leaveChannel = async (uniqueName: string) => {
    if (client) {
      const channel = await client.getChannelByUniqueName(uniqueName);
      await channel.leave()
      console.log("Should have left channel ------------")
      const remainingChannels = channels.filter(channel1 => channel1.uniqueName !== uniqueName);
      setChannels(remainingChannels);
      setTabIndex(0);
    }
  }

  // set listener channel event listeners on mount.
  useEffect(()=>{
    let isMounted = true;
    const listen = ()=> {
      if (client) {
        if(isMounted) handleChannelEvents(client);
      }
    };

    listen();

    return (()=> {isMounted = false;})
  },[client, handleChannelEvents]);


  // log into main channel on mount
  // log in useEffect-to get rid of button but will trigger anytime a channel is added
  useEffect(()=>{
    let isMounted = true;
    const login = async()=> {
      console.log("login useEffect triggered..."); // for debug
      try {
        if (client && channels.length === 0 && isMounted) { // prevents rest of function from firing off again after mount
          // console.log(await client.getLocalChannels());
          // Will Error out if token has timed out!
          const mainChannel = await client.getChannelByUniqueName(currentTownID);
          console.log(mainChannel);
          console.log(`${userName}'s status for ${mainChannel.friendlyName} is ${mainChannel.status}`); // for debug
          if(mainChannel.status !== "joined"){
            await mainChannel.join();
          };
          addChannel(mainChannel);
          await mainChannel.sendMessage(`${userName} has joined the main chat`);
        };
      } catch (error){
        throw new Error(`Unable to join channel for town ${error}`);
      }
    };

    login();

    return (()=> {isMounted = false;})
  },[client, userName, currentTownID, channels, addChannel]);


  // Renders channels tabs based on channels array.
  const renderTabs = (channels).map(channel => {
    const {friendlyName, uniqueName} = channel;

    console.log(friendlyName);

    let tabName;
    try {
      const { players: {
        currentPlayer,
        otherPlayer,
      }} = JSON.parse(friendlyName);
      if (currentPlayer.userName !== userName) {
        tabName = currentPlayer.userName;
      } else {
        tabName = otherPlayer.userName;
      }

      return (
        <Tab key={uniqueName}>
          {`Private Message with ${tabName}`} <CloseButton onClick={() => leaveChannel(uniqueName)}/>
        </Tab>
      )
    } catch {
      return friendlyName === myPlayerID ? (
        <Tab key={uniqueName}>
          Help <CloseButton onClick={() => leaveChannel(uniqueName)}/>
        </Tab>
      ) : (
        <Tab key={uniqueName}>
          Town Chat
        </Tab>
      );
    }

  });

  // Renders each channel's chat screen.
  const renderTabScreens = (channels).map(channel => {
    const {uniqueName} = channel;
    return (
      <TabPanel p={50} key={uniqueName}>
        <ChatScreen channel={channel}/>
      </TabPanel>
    )
  });


  // Private messaging work
  const createPrivateChannelFromMenu = async (currentPlayerID: string, playerToPM: Player) => {

    setPrivateChannels(oldUsers =>[...oldUsers, playerToPM.id]);
    await apiClient.createPrivateChatChannel({
      currentPlayerID,
      otherPlayerID: playerToPM.id,
      coveyTownID: currentTownID
    });
  };


  // filter the player list to only show people not the current player
  const filteredPlayerList = useNearbyPlayers().nearbyPlayers.filter(player => !privateChannels.includes(player.id));

  // players.filter(player => player.id !== myPlayerID);

  const renderPrivateMessageList = filteredPlayerList.map(player => (
    <MenuItemOption key={player.id} value={player.id}
                    onClick={() =>{createPrivateChannelFromMenu(myPlayerID, player)}}>{player.userName}</MenuItemOption>
  ));

  // Logs Work - This could be susceptible to massive chat logs since.
  const getTownChatLogs = async () => {
    if(client) {

      // get the channel, the messages and create a chatLog array
      const mainChannel = await client.getChannelByUniqueName(currentTownID);
      const messages = await mainChannel.getMessages();
      const chatLog: BlobPart[] | undefined = [];

      // fill the array with formatted messages
      messages.items.map(message =>(
        chatLog.push(`${message.dateCreated}: ${message.author.split(',')[1].replace('}','').replaceAll('"','')}:${message.body}\n`)
    ));
      // make a blob of the array, and save it.
      const blob = new Blob(chatLog, {type: "text/plain;charset=utf-8"});
      saveAs(blob, `Town_Chat_Logs.txt`);

      toast({
        title: `Downloaded Town Chat Logs`,
        status: 'success',
        isClosable: true,
        duration: null,
      })
    }
  };

  return (
    <>
      <Tabs index={tabIndex} onChange={handleTabsChange}>
        <TabList>
          {renderTabs}
        </TabList>
        <TabPanels>
          {renderTabScreens}
        </TabPanels>
      </Tabs>
      <Button onClick={createPrivateChannelWithBot}>Help</Button>
      <Button onClick={getTownChatLogs}>Logs</Button>

      <Menu>
        <MenuButton as={Button}>
          Private Message
        </MenuButton>
        <MenuList minWidth="240px" maxHeight="400px" overflow="auto">
          <MenuOptionGroup title="Select User To Private Message">
            {renderPrivateMessageList}
          </MenuOptionGroup>
        </MenuList>
      </Menu>
    </>

  )
}
