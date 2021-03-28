// handle channels in this file- wrap chatscreen in tab/tabpanels
// how to store channels and messages? I guess I can have 1 array of channels, then have chatscreen get the messages.
import React, {useCallback, useEffect, useState} from 'react';
import axios from 'axios';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {
  Button,
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuOptionGroup,
  MenuItemOption,
  MenuDivider,
  useToast
} from "@chakra-ui/react";


import {nanoid} from 'nanoid';
import {use} from "matter";
import useCoveyAppState from "../../hooks/useCoveyAppState";
import ChatScreen from "./ChatScreen";
import Player from "../../classes/Player";
import useNearbyPlayers from "../../hooks/useNearbyPlayers";



export default function ChannelWrapper({chatToken}: { chatToken: string }): JSX.Element {
  const [client, setClient] = useState<Client>();
  const [loading, setLoading] = useState<boolean>(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [mainChannelJoined, setMainChannelJoined] = useState<boolean>(false);
  const {currentTownID, currentTownFriendlyName, userName, players, myPlayerID, apiClient} = useCoveyAppState();
  const [tabIndex, setTabIndex] = React.useState(0)
  const toast = useToast();

  const handleTabsChange = useCallback((index) => {
    setTabIndex(index)
  },[]);

  const addChannel = (newChannel: Channel) => {
    const exists = channels.find(each => each.uniqueName === newChannel.uniqueName);
    if (!exists) {
      setChannels(old => [...old, newChannel]);
    } else {
      if (newChannel.uniqueName === currentTownID) {
        setMainChannelJoined(true);
      }
      console.log("Channel already Added.");
    }
  }

  const joinChannel = async (channelToJoin: Channel) => {
    if (channelToJoin.status === "joined") {
      if(channelToJoin.uniqueName === currentTownID){
        addChannel(channelToJoin);
      }
      console.log(`Channel, ${channelToJoin.friendlyName} already joined.`);
    } else {
      console.log(`Status for ${channelToJoin.friendlyName} is ${channelToJoin.status}`);
      const response = await channelToJoin.join();
      await channelToJoin.sendMessage(`${userName} joined the main chat for ${channelToJoin.friendlyName}`);
      addChannel(response);
    }
  }

  const mainChannelLogIn = async () => {
    if (client) {
      // setChannels((await client.getSubscribedChannels()).items);

      client.on('channelJoined', async (joinedChannel: Channel) => {
        // const channelMessages = await joinedChannel.getMessages();
        console.log(`chat client channelJoined event on ${joinedChannel.friendlyName} has occurred`);
      });

      client.on('channelInvited', async (channel) => {
        console.log(`Invited to channel ${channel.friendlyName}`);
        // Join the channel that you were invited to
        await channel.join();
        await channel.sendMessage(`${userName} joined the chat`);
        setChannels(oldChannels =>[...oldChannels, channel])
      });

    }
    try {
      if (client) {
        const mainChannel = await client.getChannelByUniqueName(currentTownID);
        await joinChannel(mainChannel);
        setMainChannelJoined(true);
      }
    } catch {
      throw new Error(`Unable to join channel for ${currentTownFriendlyName}`);
    }
  }

  const createPrivateChannelWithBot = async () => {
    try {
      await apiClient.createChatBotChannel({
        playerID: myPlayerID,
        coveyTownID: currentTownID,
      })
      setTabIndex(channels.length)
    } catch (err) {
      toast({
        title: 'Unable to create help chat',
        description: err.toString(),
        status: 'error'
      })
    }
  }

  // UseEffect-- on mounting, gets the chat client object.
  // could also attempt to join main room chat here.
  useEffect(() => {
    let isMounted = true;
    const logIn = async () => {
      setLoading(true);
      try {

        const newClient = await Client.create(chatToken);
        if (isMounted) setClient(newClient);
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
    try {
      await apiClient.createPrivateChatChannel({
        currentPlayerID,
        otherPlayerID: playerToPM.id,
        coveyTownID: currentTownID
      });
    } catch (err) {
      toast({
        title: 'Unable to connect to create private chat',
        description: err.toString(),
        status: 'error'
      })
    }
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
      <Button onClick={mainChannelLogIn} isDisabled={mainChannelJoined}>Log in to Main
        Channel</Button>
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
