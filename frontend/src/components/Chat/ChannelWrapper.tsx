import React, {useCallback, useEffect, useRef, useState} from 'react';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {
  Button, Tabs, Tab, TabList, TabPanels, TabPanel, Menu,
  MenuButton, MenuList, MenuOptionGroup, MenuItemOption, useToast,
} from "@chakra-ui/react";
import {CloseIcon} from '@chakra-ui/icons'
import {saveAs} from 'file-saver';

import {Member} from "twilio-chat/lib/member";
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
  const [mainChannelJoined, setMainChannelJoined] = useState<boolean>(false);
  const {currentTownID, currentTownFriendlyName, userName, myPlayerID, apiClient } = useCoveyAppState();

  const [privateChannels, setPrivateChannels] = useState<string[]>([]);
  const toast = useToast();

  const handleTabsChange = useCallback((index) => {
    setTabIndex(index)
  }, []);

  // checks if channel already exists, then adds to channels array if not already exists.
  const addChannel = useCallback((newChannel: Channel) => {
    const exists = channels.find(each => each.uniqueName === newChannel.uniqueName);
    if (!exists) {
      setChannels(old => [...old, newChannel]);
    }
  }, [channels]);

  // handle leaving a channel
  const leaveChannel = async (uniqueName: string) => {
    if (client) {
      const channel = await client.getChannelByUniqueName(uniqueName);
      await channel.leave();
      console.log("Should have left channel ------------");
      const remainingChannels = channels.filter(channel1 => channel1.uniqueName !== uniqueName);
      setChannels(remainingChannels);
      setTabIndex(0);
    }
  };

  // handle closing a private message
  const handleCloseButtonPrivateMessage = async (otherPlayer: { playerID: string; }, currentPlayer: { playerID: string; }, uniqueName: string) => {

    // we are using other and current player because we want to ensure that neither player has the other on their list.
    const newPrivateChannels = privateChannels.filter(player => (![otherPlayer.playerID,currentPlayer.playerID].includes(player)));

    setPrivateChannels(newPrivateChannels);
    await leaveChannel(uniqueName);
  };

  // Handler for channel events
  const handleChannelEvents = useCallback(async(channelClient : Client)=>{
      channelClient.on('channelJoined', async (joinedChannel: Channel) => {
        console.log(`chat client channelJoined event on ${joinedChannel.friendlyName} has occurred`);
      });

      channelClient.on('channelInvited', async (channel: Channel) => {
      console.log(`Invited to channel ${channel.friendlyName}`); // can become toast as user indicator
      // Join the channel that you were invited to
      await channel.join();
      await channel.sendMessage(`joined the chat`);
      const getFirstMessage = await channel.getMessages();

      // Relies on the idea that the first message comes from the inviting user!
      setPrivateChannels(oldUsers =>[...oldUsers, JSON.parse(getFirstMessage.items[0].author).playerID]);
      setChannels(oldChannels =>[...oldChannels, channel])
    });

      channelClient.on('memberLeft', async (channel: Member) => {
        const members = JSON.parse(channel.channel.friendlyName);
        const {uniqueName} = channel.channel;
        const {currentPlayer, otherPlayer} = members.players;
        console.log("member left")
      });


  },[]);

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

  // set listener channel event listeners on mount.
  useEffect(() => {
    const listen = () => {
      if (client) {
        handleChannelEvents(client);
      }
    };

    listen();

    return (() => {
    })
  }, [client, handleChannelEvents]);


  // log into main channel on mount
  // log in useEffect-to get rid of button but will trigger anytime a channel is added
  useEffect(() => {
    const login = async () => {
      console.log("login useEffect triggered..."); // for debug
      try {
        if (client && channels.length === 0) { // prevents rest of function from firing off again after mount
          // console.log(await client.getLocalChannels());
          // Will Error out if token has timed out!
          const mainChannel = await client.getChannelByUniqueName(currentTownID);
          console.log(mainChannel);
          console.log(`${userName}'s status for ${mainChannel.friendlyName} is ${mainChannel.status}`); // for debug
          if (mainChannel.status !== "joined") {
            await mainChannel.join();
          }
          addChannel(mainChannel);
          await mainChannel.sendMessage(`${userName} has joined the main chat`);
        }
      } catch (error) {
        throw new Error(`Unable to join channel for town ${error}`);
      }
    };

    login();

    return (() => {
    })
  }, [client, userName, currentTownID, channels, addChannel]);


  // the purpose of the function is to check if two players are both in the players list
  const checkPlayersExistence = (otherPlayer: { playerID: string; }, currentPlayer: { playerID: string; }) => {

    const filtered = players.filter(player => player.id === otherPlayer.playerID || player.id === currentPlayer.playerID);

    return filtered.length >=2;
  };

  // creates a filtered channel list
  const filteredChannelList = () => {
    const listToFilter: Channel[] = [];
    channels.map(channel => {
      const {friendlyName} = channel;
      try{
        const { players: {
          currentPlayer,
          otherPlayer,
        }} = JSON.parse(friendlyName);
        if(checkPlayersExistence(currentPlayer,otherPlayer)){
          listToFilter.push(channel)
        }
      } catch {
        listToFilter.push(channel)
      }
      return listToFilter;
    });
    return listToFilter;
  };

  // Renders channels tabs based on channels array.
  const renderTabs = (filteredChannelList()).map(channel => {
    const {friendlyName, uniqueName} = channel;

    console.log(friendlyName);

    let tabName;
    try {
      const {
        players: {
          currentPlayer,
          otherPlayer,
        }
      } = JSON.parse(friendlyName);
      if (currentPlayer.userName !== userName) {
        tabName = currentPlayer.userName;
      } else {
        tabName = otherPlayer.userName;
      }

        return (
          <Tab key={uniqueName}>
            {`Private Message with ${tabName}`} <CloseIcon onClick={() => handleCloseButtonPrivateMessage(otherPlayer, currentPlayer, uniqueName)}/>
          </Tab>
        );

    } catch {
      return friendlyName === myPlayerID ? (
        <Tab key={uniqueName}>
          Help <CloseIcon onClick={() => leaveChannel(uniqueName)}/>
        </Tab>
      ) : (
        <Tab key={uniqueName}>
          Town Chat
        </Tab>
      );
    }

  });

  // Renders each channel's chat screen.
  const renderTabScreens = (filteredChannelList()).map(channel => {
    const {uniqueName} = channel;
      return (
        <TabPanel p={50} key={uniqueName}>
          <ChatScreen channel={channel}/>
        </TabPanel>
      )
    });


  // Private messaging work
  const createPrivateChannelFromMenu = async (currentPlayerID: string, playerToPM: Player) => {

    setPrivateChannels(oldUsers => [...oldUsers, playerToPM.id]);
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
                    onClick={() => {
                      createPrivateChannelFromMenu(myPlayerID, player)
                    }}>{player.userName}</MenuItemOption>
  ));

  // Logs Work - This could be susceptible to massive chat logs since.
  const getTownChatLogs = async () => {
    if (client) {

      // get the channel, the messages and create a chatLog array
      const mainChannel = await client.getChannelByUniqueName(currentTownID);
      const messages = await mainChannel.getMessages();
      const chatLog: BlobPart[] | undefined = [];

      // fill the array with formatted messages
      messages.items.map(message =>(
        chatLog.push(`${message.dateCreated}: ${JSON.parse(message.author).userName}:${message.body}\n`)
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
