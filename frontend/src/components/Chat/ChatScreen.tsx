import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Channel} from 'twilio-chat/lib/channel';
import {Button, Input, Stack, Flex, Text, Box, Spacer, Heading} from "@chakra-ui/react";
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
  useEffect(() => {

    const messageListener = () => {

      thisChannel.on("messageAdded", (messageToAdd: Message) => {
        setMessages(old => [...old, messageToAdd]);
      });
    };
    messageListener();
    return (() => {
      thisChannel.removeAllListeners();
    });
  }, [thisChannel]);


  // useEffect for initializing old messages to chatbox
  useEffect(() => {
    const handleChannel = async () => {
      const previousMessages = await thisChannel.getMessages();
      const mes: Message[] = previousMessages.items;
      setMessages(mes);
    };

    handleChannel();
    return () => {
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
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollPosition = (event.target as HTMLDivElement).scrollTop;
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
    const scroll = () => {
      if (hasReachedBottom) scrollToBottom();
    }
    scroll();
    return (() => {
    });
  }, [messages.length, hasReachedBottom, scrollToBottom]);

  const getMessageTime = (chat: Message) => {
    const timeToSting = chat.dateCreated.toLocaleDateString('en-US',
      {hour: 'numeric', minute: 'numeric', hour12: true})
    return timeToSting.split(',')[1];
  }

  let lastAuthor = 'temp';
  let isAuthorChanged = true;

  const renderMessages = messages.map(message => {
    const {author} = message;
    let authorString = getMessageAuthor(author); // username
    let authorID;
    if (author === "system") {
      authorID = "system";
    } else {
      authorID = JSON.parse(author).playerID;
    }

    if (lastAuthor !== authorID) {
      lastAuthor = authorID;
      isAuthorChanged = false;
    } else {
      isAuthorChanged = true;
    }

    if (authorID === myPlayerID) {
      authorString = authorString.concat('(you)');
    }

    return (
      <>
        {
          !isAuthorChanged &&
          <>
            <Flex maxW="90%" key={message.sid} ref={endRef} rounded="md">
              <Box>
                <Heading size="sm">{authorString}</Heading>
              </Box>
              <Spacer/>
              <Box>
                {getMessageTime(message)}
              </Box>
            </Flex>
            <Box key={`${message.sid} ${myPlayerID}`} flex="1" bg="#008080"
                 rounded="md" boxShadow="base"
                 marginBottom="3" maxW="90%">
              <Text margin="5" color="beige">{message.body} </Text>
            </Box>
          </>
        }
        {
          isAuthorChanged &&
          <Box key={message.sid} flex="1" bg="#008080" rounded="md" boxShadow="base"
               marginBottom="3" maxW="90%">
            <Text margin="5" color="beige">{message.body}</Text>
          </Box>
        }
      </>
    )

  });

  return (
    <>
      <Stack>
        <div>
          <Flex display="flex" height="500px"
                ref={containerRef} overflowY="scroll"
                flexDirection="column" flexGrow={1}
                onScroll={handleScroll} maxW="100%">
            <Flex flex="1 1 auto"/>
            <Flex>
              {
                !hasReachedBottom &&
                <Button onClick={scrollToBottom} colorScheme="red"
                        marginRight="2" position="absolute">
                  Scroll to bottom
                </Button>
              }
            </Flex>
            {renderMessages}
          </Flex>
          <Input w="90%" marginRight="1"
                 autoFocus maxW="90%"
                 name="name" placeholder="Type message here..."
                 bg="white" autoComplete="off"
                 onChange={(event) => setText(event.target.value)}
                 value={text}
                 onKeyPress={event => {
                   if (event.key === "Enter") sendMessage()

                 }}
                 onFocus={() => Video.instance()?.pauseGame()}
                 onBlur={() => Video.instance()?.unPauseGame()}
          />
          <Button
            w="10%" onClick={sendMessage}
            isLoading={loading}
            disabled={!channel || !text} colorScheme="teal">
            Send
          </Button>
        </div>
      </Stack>
    </>
  );
}

