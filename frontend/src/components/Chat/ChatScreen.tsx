import React, { createRef, useCallback, useEffect, useState } from 'react';
import { Channel } from 'twilio-chat/lib/channel';
import { Box, Button, Input, Stack } from "@chakra-ui/react";
import { Message } from 'twilio-chat/lib/message';
import Video from "../../classes/Video/Video";

/**
 * ChatScreen is a React Component that handles the messaging functionality of a given channel.
 * @param channel The channel for this ChatScreen.
 * @returns React component that displays messages, allows input to send messages, and send button.
 */
export default function ChatScreen({channel}: { channel: Channel }): JSX.Element {
  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [thisChannel] = useState<Channel>(channel);

  const chatContainer = createRef<HTMLDivElement>();


  // useEffect for message added listener
  useEffect(()=>{
    const messageListener =()=>{
      thisChannel.on("messageAdded", (messageToAdd: Message) => {
        setMessages(old => [...old, messageToAdd]);

      });
    };
    messageListener();
    return (() => {});
  }, [thisChannel]);


  // useEffect for initializing old messages to chatbox
  useEffect(() => {
    let isMounted = true;
    const handleChannel = async () => {
      const previousMessages = await thisChannel.getMessages();
      const mes: Message[] = previousMessages.items;
      if (isMounted) setMessages(mes);
    };
    handleChannel();
    return () => {
      isMounted = false
    };
  }, [thisChannel]);


  // sends messages to channel
  const sendMessage = () => {
    if (text && String(text).trim()) {
      setLoading(true);
      channel.sendMessage(text);
      setText("");
      setLoading(false);
    }
  };


  const scrollToBottom = useCallback (() => {
    if(chatContainer.current) {
      const scroll =
        chatContainer.current.scrollHeight -
        chatContainer.current.clientHeight;
      chatContainer.current.scrollTo(0, scroll);
    }
  },[chatContainer]);

  useEffect(() => {
    scrollToBottom();
    return (() => {});
  }, [messages, scrollToBottom]);


  const getMessageAuthor = (author: string) => {
    try {
      return JSON.parse(author).userName
    } catch {
      return author
    }
  };

  return (
    <>
      <Stack>
        <div>
          <Box maxH="500px" overflowY="scroll" ref={chatContainer}>
            {messages.map((message) =>
              <div key={message.sid}>
                <b>{getMessageAuthor(message.author)}</b>:{message.body}
              </div>)
            }
          </Box>
          <Input w="90%" autoFocus name="name" placeholder=""
                 autoComplete="off"
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
