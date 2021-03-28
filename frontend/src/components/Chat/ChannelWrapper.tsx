// handle channels in this file- wrap chatscreen in tab/tabpanels
// how to store channels and messages? I guess I can have 1 array of channels, then have chatscreen get the messages.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import axios from 'axios';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {
  Button, Tabs, Tab, TabList, TabPanels, TabPanel, Menu,
  MenuButton, MenuList, MenuOptionGroup, MenuItemOption, useToast
} from "@chakra-ui/react";


import {nanoid} from 'nanoid';
import {use} from "matter";

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
  const {currentTownID, currentTownFriendlyName, userName, myPlayerID, apiClient} = useCoveyAppState();
  const [tabIndex, setTabIndex] = useState(0);
  const [mainChannelJoined, setMainChannelJoined] = useState<boolean>(false);
  const {currentTownID, currentTownFriendlyName, userName, players, myPlayerID, apiClient} = useCoveyAppState();
  const [tabIndex, setTabIndex] = useState(0);
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
    };
  },[channels]);

  // Handler for channel events
  const handleChannelEvents = useCallback(async(channelClient : Client)=>{
      channelClient.on('channelJoined', async (joinedChannel: Channel) => {
        console.log(`chat client channelJoined event on ${joinedChannel.friendlyName} has occurred`);
      });

      channelClient.on('channelInvited', async (channel: Channel) => {
        console.log(`Invited to channel ${channel.friendlyName}`); // can become toast as user indicator
        // Join the channel that you were invited to
        const response = await channel.join();
        await response.sendMessage(`${userName} has joined the chat`);
        setChannels(oldChannels =>[...oldChannels, response]); // should check if already in the private chat
        await channel.join();
        await channel.sendMessage(`${userName} joined the chat`);
        const getFirstMessage = await channel.getMessages();

        // Relies on the idea that the first message comes from the inviting user!
        setPrivateChannels(oldUsers =>[...oldUsers, JSON.parse(getFirstMessage.items[0].author).playerID]);
        setChannels(oldChannels =>[...oldChannels, channel])
      });
  },[userName]);

  const createPrivateChannelWithBot = async () => {
    try {
      await apiClient.createChatBotChannel({
        playerID: myPlayerID,
        coveyTownID: currentTownID,
      })
      setTabIndex(channels.length)
    } catch {
      throw new Error(`Unable to create channel with a bot`);
    }
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


  // set listener channel event listeners on mount.
  useEffect(()=>{
    const listen = ()=> {
      if (client) {
        handleChannelEvents(client);
      }
    };

    listen();

    return (()=> {})
  },[client, handleChannelEvents]);


  // log into main channel on mount
  // log in useEffect-to get rid of button but will trigger anytime a channel is added
  useEffect(()=>{
    const login = async()=> {
      console.log("login useEffect triggered..."); // for debug
      try {
        if (client && channels.length === 0) { // prevents rest of function from firing off again after mount
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

    return (()=> {})
  },[client, userName, currentTownID, channels, addChannel]);


  // Renders channels tabs based on channels array.
  const renderTabs = (channels).map(channel => {
    const {friendlyName, uniqueName} = channel;

    let tabName;
    try {
      const { players: {
        player1,
        player2
      }} = JSON.parse(friendlyName);

      if (player1 !== userName) {
        tabName = player1;
      } else {
        tabName = player2;
      }
      return (
        <Tab key={uniqueName}>
          {`Private Message with ${tabName}`}
        </Tab>
      )
    } catch {
      return friendlyName === 'Help' ? (
        <Tab key={uniqueName}>
          {friendlyName}
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
      <Button onClick={mainChannelLogIn} isDisabled={mainChannelJoined}>Log in to Main
        Channel</Button>
      <Button onClick={getTownChatLogs} isDisabled={!mainChannelJoined}>Logs</Button>
      <Button onClick={createPrivateChannelWithBot} isDisabled={!mainChannelJoined}>Help</Button>

      <Menu>
        <MenuButton isDisabled={!mainChannelJoined} as={Button}>
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
