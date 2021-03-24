import React, {useCallback, useEffect, useRef, useState, createRef} from 'react';
import axios from 'axios';
import Client from 'twilio-chat';
import {Channel} from 'twilio-chat/lib/channel';
import {Box, Button, Input, Stack, Table, Tbody, Td, Tr, Grid, GridItem} from "@chakra-ui/react";

import useCoveyAppState from "../../hooks/useCoveyAppState";

type Message = {
  state: {
    author: string
    body: string
    sid: string
  }
};



export default function ChatScreen(): JSX.Element {
  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [channel, setChannel] = useState<Channel>();

  const { currentTownID, currentTownFriendlyName, userName } = useCoveyAppState()
  const messagesEndRef = useRef(null);
  const chatContainer = createRef<HTMLDivElement>();


  // TODO We should probably create a client to communicate to the Chat Backend
  const getToken = async (email: string) => {
    const response = await axios.get(`http://localhost:3003/token/${email}`);
    const { data } = response;
    return data.token;
  };




  const handleMessageAdded = (messageToAdd: Message) => {
    const message :Message = {
      state: {
        author: messageToAdd.state.author,
        body: messageToAdd.state.body,
        sid: messageToAdd.state.sid,
      },
    }
    // setMessages(messages ? [...messages, message] : [message])
    setMessages(oldMessages => [...oldMessages, message]);
    console.log('messages', messages)
    console.log('message', message)
    // setMessages(messages ? [...messages, messageToAdd] : [messageToAdd])
    // messages.push(messageToAdd)
    console.log(messages)

  }

  const joinChannel = useCallback(async (channelToJoin) => {
    if (channelToJoin.channelState.status !== "joined") {
      await channelToJoin.join();
    }
    console.log('messages in joinChannel', messages)
    channelToJoin.on("messageAdded", handleMessageAdded);

  },[handleMessageAdded, messages]);

/*
Reference: https://stackoverflow.com/questions/37620694/how-to-scroll-to-bottom-in-react
 */
  const scrollToBottom = () => {
    chatContainer.current?.scrollIntoView({ behavior: "smooth" });
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages])


  const sendMessage =() => {
    console.log(messages)
    if (text && String(text).trim()) {
      setLoading(true)
      // channel && channel.sendMessage(text);

      if (channel) {
        console.log(text)
        channel.sendMessage(text)
      }

      setText("");
      setLoading(false);
    }

  }

  const loginToChat = useCallback(async () => {

    let token = '';
    setLoading(true)

    try {
      token = await getToken(userName);
    } catch {
      throw new Error("unable to get token, please reload this page");
    }

    const client = await Client.create(token);

    client.on("tokenAboutToExpire", async () => {
      const token1 = await getToken(userName);
      await client.updateToken(token1);
    });

    client.on("tokenExpired", async () => {
      const token2 = await getToken(userName);
      await client.updateToken(token2);
    });

    client.on("channelJoined", async (channelToJoin) => {
      // getting list of all messages since this is an existing channel
      const mes = await channelToJoin.getMessages();


      const mes2 : Message[] = mes.items.map((message: Message) => ({
        state: {
          body: message.state.body,
          sid: message.state.sid,
          author: message.state.author
        }
      }))
      setMessages(mes2)

    });

    try {
      const channelToJoin = await client.getChannelByUniqueName(currentTownID);
      joinChannel(channelToJoin).then(()=>{
        channelToJoin.sendMessage('HAS JOINED THE CHAT')
      })
      setChannel(channelToJoin)
    } catch {
    try {
      const channelToJoin = await client.createChannel({
        uniqueName: currentTownID,
        friendlyName: currentTownFriendlyName,
      });
      joinChannel(channelToJoin).then(()=>{
        channelToJoin.sendMessage(' HAS ENTERED THE CHAT');
      });
      setChannel(channelToJoin)
      setLoading(false)

      console.log('channel', channel);
      console.log('messages', messages);
    } catch {
      throw new Error('unable to create channel, please reload this page');
    }
    }
  }, [channel, currentTownFriendlyName, currentTownID, joinChannel, messages, userName])


  const enterToSend = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if(event.key === 'Enter'){
      sendMessage();
    }
  }

  return (
    <>
      <Stack>
        <div>
          <Box maxH="500px" overflowY="scroll">
            {messages.map((message) =>
          <div key={message.state.sid}>
            <b>{message.state.author}</b>:{message.state.body}
            <div ref={chatContainer}/>
          </div>)
            }
          </Box>
        </div>
        <div>
        <Input w="90%"
             autoFocus name="name"
             placeholder="Type a message"
             onChange={(event) => setText(event.target.value)}
             value={text}
             onKeyDown={(e) => enterToSend(e)}
        />
        <div>
          <Button w="10%" onClick={sendMessage} disabled={!channel || !text}>Send</Button>
        </div>
        <Button onClick={loginToChat} >Login to Chat</Button>
        </div>
      </Stack>
    </>
  );


}

