import React, { useCallback, useEffect, useRef, useState} from 'react';
import {Channel} from 'twilio-chat/lib/channel';
import { Button, Input, Stack, Flex, Text } from "@chakra-ui/react";
import {Message} from 'twilio-chat/lib/message';

import Video from "../../classes/Video/Video";
import useCoveyAppState from '../../hooks/useCoveyAppState';


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
  const {myPlayerID} = useCoveyAppState();



  // useEffect for message added listener
  useEffect(()=>{
    let isMounted = true;
    console.log('calling message handler');
    const messageListener =()=>{
      if(isMounted)
      thisChannel.on("messageAdded", (messageToAdd: Message) => {
        setMessages(old => [...old, messageToAdd]);
        console.log("message added listener has been called.")
        // console.log(messages);
      });
    };
    messageListener();
    return (() => {isMounted = false});
  }, [thisChannel]);


  // useEffect for initializing old messages to chatbox
  useEffect(() => {
    let isMounted = true;
    const handleChannel = async () => {
      const previousMessages = await thisChannel.getMessages();
      const mes: Message[] = previousMessages.items;
      if (isMounted) setMessages(mes);
      console.log(`Channel got messages ${mes}`);
    };

    handleChannel();
    return () => {
      isMounted = false
    };
  }, [thisChannel]);


  // sends messages to channel
  const sendMessage = () => {
    // console.log(messages)
    if (text && String(text).trim()) {
      setLoading(true);

      channel.sendMessage(text);

      setText("");
      setLoading(false);
    }
  };

  const getMessageAuthor = (author: string) => {
    try {
      return JSON.parse(author).userName
    } catch {
      return author
    }
  };


  type ChatScrollPositionsType = { [chatId: string]: number };

  const [
    chatScrollPositions,
    setChatScrollPositions
  ] = useState<ChatScrollPositionsType>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);


  const updateCurrentChatScrollPosition = (scrollPosition: number) => {
    setChatScrollPositions({
      ...chatScrollPositions,
      [thisChannel.sid]: scrollPosition
    });
  };

  const handleScroll = (event: any) => {
    const scrollPosition = event.target.scrollTop;
    if (scrollPosition !== 0) {
      updateCurrentChatScrollPosition(scrollPosition);
    }
  };


  const currentRef = containerRef.current;

  const scrollToBottom = useCallback(() => {
    const returnValue = currentRef &&
      (currentRef.scrollTop = currentRef.scrollHeight - currentRef.clientHeight);
    return returnValue;
  }, [currentRef]);

  const hasReachedBottom = currentRef
    ? currentRef.scrollHeight - currentRef.clientHeight === currentRef.scrollTop
    : false;

  useEffect(() => {
    let isMounted = true;
    const scroll = ()=>{
      if (hasReachedBottom && isMounted) scrollToBottom();
    }
    scroll();
    return (() => {isMounted = false});
  }, [messages.length, hasReachedBottom, scrollToBottom]);

  const renderMessages = messages.map(message => {
    const {author} = message;
    const authorID = JSON.parse(author).playerID;
    // console.log(author);
    const authorString = getMessageAuthor(author);
    if(authorID === myPlayerID){
      return (
        <div key={message.sid} ref={endRef}>
          <Text color='blue'><b>{`${authorString} (you)`}</b></Text>:{message.body}
        </div>
      )} 
        return (
          <div key={message.sid} ref={endRef}>
            <b>{authorString}</b>:{message.body}
          </div>
        )
  });

  return (
    <>
      <Stack >
        <div >
          <Flex display="flex"
                height="500px"
                ref={containerRef}
                overflowY="scroll"
                flexDirection="column"
                flexGrow={1}
                onScroll={handleScroll}>
            <Flex flex="1 1 auto"/>
            {renderMessages}
          </Flex>
          <Input w="90%" autoFocus
                 name="name"
                 placeholder=""
                 autoComplete="off"
                 bg = "white"
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

