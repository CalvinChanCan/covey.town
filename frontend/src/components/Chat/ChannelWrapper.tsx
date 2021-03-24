import React, {useEffect, useState} from 'react';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {Button, Tabs, Tab, TabList, TabPanels, TabPanel, useToast} from "@chakra-ui/react";

import {nanoid} from 'nanoid';
import useCoveyAppState from "../../hooks/useCoveyAppState";
import ChatScreen from "./ChatScreen";
// TODO: some console logs kept for debugging purposes, will need to remove before final submission.

/**
 * ChannelWrapper manages channels. It takes in the chat token to generate a client, 
 * which is used for channel management.
 * @param chatToken the token used to create the Chat Client 
 * @returns A React Component that displays the full chat window
 */
export default function ChannelWrapper({chatToken}: { chatToken: string }): JSX.Element {
  const [client, setClient] = useState<Client>();
    // May use this as loading indicator in UI.
  const [loading, setLoading] = useState<boolean>(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [mainChannelJoined, setMainChannelJoined] = useState<boolean>(false);
  const {currentTownID, currentTownFriendlyName, userName} = useCoveyAppState();
  const toast = useToast();

  const addChannel = (newChannel: Channel) => {
    const exists = channels.find(each => each.uniqueName === newChannel.uniqueName);
    if (!exists) {
      setChannels(old => [...old, newChannel]);
    } else {
      if (newChannel.uniqueName === currentTownID) {
        setMainChannelJoined(true);
      }
      console.log(`The Channel ${newChannel.friendlyName} has already been added.`);
    }
  }

  const joinChannel = async (channelToJoin: Channel) => {
    if (channelToJoin.status === "joined") {
      console.log(`Channel, ${channelToJoin.friendlyName} already joined.`);
    } else {
      console.log(`Status for ${channelToJoin.friendlyName} is ${channelToJoin.status}`);
      const response = await channelToJoin.join();
      channelToJoin.sendMessage(`${userName} has joined ${channelToJoin.friendlyName}`);
      addChannel(response);
    }
  }

  const createChannel = async (channelID: string, channelFriendlyName: string) => {
    if (client) {
      const createdChannel = await client.createChannel({
        uniqueName: channelID,
        friendlyName: channelFriendlyName,
      });
      toast({
        title: 'Channel Created',
        description: `The Channel, ${channelFriendlyName} has been created!`,
        status: 'success'
      });

      return createdChannel;
    }
    throw Error(`Something went wrong, client error. Please come back later.`);
  }

  const mainChannelLogIn = async () => {
    if (client) {
      setChannels((await client.getSubscribedChannels()).items);

      client.on('channelJoined', async (joinedChannel: Channel) => {
        toast({
            title: 'Channel Joined',
            description: `You have joined ${joinedChannel.friendlyName}`,
            status: 'success'
          });
      });
    }
    try {
      if (client) {
        const mainChannel = await client.getChannelByUniqueName(currentTownID);
        await joinChannel(mainChannel);
        setMainChannelJoined(true);
      }
    } catch {
      try {
        const created = await createChannel(currentTownID, currentTownFriendlyName);
        await joinChannel(created);
        setMainChannelJoined(true);
      } catch {
        toast({
            title: 'Channel Error',
            description: `Unable to create or join channel for ${currentTownFriendlyName}`,
            status: 'error'
          });
      }
    }
  }

  const createPrivateChannel = async () => {
    try {
      const created = await createChannel(nanoid(), nanoid(5));
      await joinChannel(created);
    } catch {
        toast({
            title: 'Channel Error',
            description: `Unable to create or join private channel`,
            status: 'error'
          });
    }
  }

  // UseEffect-- on mounting, gets the chat client object using chatToken.
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


  const renderTabs = (channels).map(c => {
    const {friendlyName, uniqueName} = c;
    return (
      <Tab key={uniqueName}>
        {friendlyName}
      </Tab>
    )
  });

  const renderTabScreens = (channels).map(c => {
    const {uniqueName} = c;
    return (
      <TabPanel p={50} key={uniqueName}>
        <ChatScreen channel={c}/>
      </TabPanel>
    )
  });


  return (
    <>
      <Tabs>
        <TabList>
          {renderTabs}
        </TabList>
        <TabPanels>
          {renderTabScreens}
        </TabPanels>
      </Tabs>
      <Button onClick={mainChannelLogIn} isDisabled={mainChannelJoined}>Log in to Main
        Channel</Button>
      <Button onClick={createPrivateChannel}>Start New Chat</Button>
    </>

  )
}
