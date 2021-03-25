import React, {createRef, useCallback, useEffect, useRef, useState} from 'react';
import {Channel} from 'twilio-chat/lib/channel';
import {Box, Button, Input, Stack, Tabs, Tab, TabList} from "@chakra-ui/react";
import {Message} from 'twilio-chat/lib/message';
import useCoveyAppState from "../../hooks/useCoveyAppState";
import Video from "../../classes/Video/Video";


export default function ChatScreen({channel}: { channel: Channel }): JSX.Element {
  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [thisChannel] = useState<Channel>(channel);

  const {currentTownID, currentTownFriendlyName, userName, apiClient, socket} = useCoveyAppState();
  const messagesEndRef = useRef(null);
  const chatContainer = createRef<HTMLDivElement>();

  // running 5 times?
  const handleMessageAdded = useCallback((messageToAdd: Message) => {
    setMessages(old => [...old, messageToAdd]);
    console.log(messages);
  }, [messages])

  useEffect(() => {
    let isMounted = true;
    const handleChannel = async () => {
      const previousMessages = await thisChannel.getMessages();
      const mes: Message[] = previousMessages.items;
      setMessages(mes);
      console.log('messages', mes);
      thisChannel.on("messageAdded", handleMessageAdded);
    }

    handleChannel();
    return () => {
      isMounted = false
    };
  }, [thisChannel])


  const sendMessage = () => {
    // console.log(messages)
    if (text && String(text).trim()) {
      setLoading(true);

      console.log(text);
      channel.sendMessage(text);

      setText("");
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    chatContainer.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages])


  return (
    <>
      <Stack>
        <div ref={messagesEndRef}>
          <Box maxH="500px" overflowY="scroll">
            {messages.map((message) =>
              <div key={message.sid}>
                <b>{message.author}</b>:{message.body}
                <div ref={chatContainer}/>
              </div>)
            }
          </Box>
          <Input w="90%" autoFocus name="name" placeholder=""
                 onChange={(event) => setText(event.target.value)}
                 value={text}
                 onKeyPress={event => {
                   if (event.key === "Enter") sendMessage()
                 }}
                 onFocus={() => Video.instance()?.pauseGame()}
                 onBlur={() => Video.instance()?.unPauseGame()}
          />
          <Button w="10%" onClick={sendMessage} disabled={!channel || !text}>Send</Button>
        </div>
      </Stack>
    </>
  );


}

