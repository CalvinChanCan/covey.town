// handle channels in this file- wrap chatscreen in tab/tabpanels
// how to store channels and messages? I guess I can have 1 array of channels, then have chatscreen get the messages.
import React, {useCallback, useEffect, useState} from 'react';
import axios from 'axios';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {Button, Tabs, Tab, TabList, TabPanels, TabPanel, Menu, MenuButton, MenuList, MenuOptionGroup, MenuItemOption, MenuDivider} from "@chakra-ui/react";


import {nanoid} from 'nanoid';
import {use} from "matter";
import useCoveyAppState from "../../hooks/useCoveyAppState";
import ChatScreen from "./ChatScreen";
import Player from "../../classes/Player";
import useNearbyPlayers from "../../hooks/useNearbyPlayers";

/**
 * 
 */
export default function ChannelWrapper({chatToken}: { chatToken: string }): JSX.Element {
  const [client, setClient] = useState<Client>();
  const [loading, setLoading] = useState<boolean>(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const {currentTownID, currentTownFriendlyName, userName, players, myPlayerID, apiClient} = useCoveyAppState();
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabsChange = useCallback((index) => {
    setTabIndex(index)
  },[]);

  const addChannel = useCallback((newChannel: Channel) => {
    const exists = channels.find(each => each.uniqueName === newChannel.uniqueName);
    if (!exists) {
      setChannels(old => [...old, newChannel]);
    } else {
      console.log("Channel already Added.");
    }
  },[channels]);

  const handleChannelEvents = useCallback(async(channelClient : Client)=>{
      channelClient.on('channelJoined', async (joinedChannel: Channel) => {
        console.log(`chat client channelJoined event on ${joinedChannel.friendlyName} has occurred`);
      });

      channelClient.on('channelInvited', async (channel: Channel) => {
        console.log(`Invited to channel ${channel.friendlyName}`);
        // Join the channel that you were invited to
        const response = await channel.join();
        await response.sendMessage(`${userName} has joined the chat`);
        setChannels(oldChannels =>[...oldChannels, response]); // should check if already in the private chat
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


  // UseEffect-- on mounting, gets the chat client object.
  // could also attempt to join main room chat here.
  useEffect(() => {
    let isMounted = true;
    const logIn = async () => {
      setLoading(true);
      try {

        const newClient = await Client.create(chatToken);
        if (isMounted) {
          console.log("CLIENT SET HERE");
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


  useEffect(()=>{
    const listen = ()=> {
      if (client) {
        handleChannelEvents(client);
        console.log('Channel Listener HERE');
      }
    };

    listen();

    return (()=> {})
  },[client, handleChannelEvents]);


  // log in useEffect-to get rid of button but will trigger anytime a channel is added
  useEffect(()=>{
    const login = async()=> {
      console.log("login useEffect triggered...");
      try {
        if (client && channels.length === 0) { // prevents rest of function from firing off again after mount
          const mainChannel = await client.getChannelByUniqueName(currentTownID);
          console.log(`Status for ${mainChannel.friendlyName} is ${mainChannel.status}`);
          if(mainChannel.status !== "joined"){
            await mainChannel.join();
          };
          addChannel(mainChannel);
          await mainChannel.sendMessage(`${userName} has joined the main chat`);
        };
      } catch {
        throw new Error(`Unable to join channel for town`);
      }
    };

    login();

    return (()=> {})
  },[client, userName, currentTownID, channels, addChannel]);



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
    await apiClient.createPrivateChatChannel({
      currentPlayerID,
      otherPlayerID: playerToPM.id,
      coveyTownID: currentTownID
    });
  };



  // filter the player list to only show people not the current player
  const filteredPlayerList = useNearbyPlayers().nearbyPlayers;

  // players.filter(player => player.id !== myPlayerID);

  const renderPrivateMessageList = filteredPlayerList.map(player => (
    <MenuItemOption key={player.id} value={player.id}
                    onClick={() =>{createPrivateChannelFromMenu(myPlayerID, player)}}>{player.userName}</MenuItemOption>
  ));


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
