import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Channel} from 'twilio-chat/lib/channel';
import {Box, Button, Input, Stack} from "@chakra-ui/react";
import {Message} from 'twilio-chat/lib/message';

/**
 * ChatScreen is a React Component that handles the messaging functionality of a given channel.
 * @param channel The channel for this ChatScreen. 
 * @returns React component that dispalys messages, allows input to send messages, and send button.
 */
export default function ChatScreen({channel}: { channel: Channel }): JSX.Element {
  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  // May use this as loading indicator in UI.
  const [loading, setLoading] = useState<boolean>(false);
  const [thisChannel] = useState<Channel>(channel);

  const messagesEndRef = useRef(null);

  // adds new incoming messages to messages array to display to user
  const handleMessageAdded = useCallback((messageToAdd: Message) => {
    setMessages(old => [...old, messageToAdd]);
  },[]);

  // UseEffect that gets old messages on mount, listens for new messages.
  useEffect(() => {
    let isMounted = true;
    const handleChannel = async () => {
      const previousMessages = await thisChannel.getMessages();
      const mes: Message[] = previousMessages.items;
      if(isMounted) setMessages(mes);
      console.log('messages', mes);
      thisChannel.on("messageAdded", handleMessageAdded);
    }

    handleChannel();
    return () => {
      isMounted = false
    };
  }, [thisChannel])


  // Sends the message to channel and handles text displayed in input box.
  const sendMessage = () => {
    if (text && String(text).trim()) {
      setLoading(true);
      channel.sendMessage(text);
      setText("");
      setLoading(false);
    }
  };


  return (
    <>
      <Stack>
        <div ref={messagesEndRef}>
          <Box maxH="500px" overflowY="scroll">
            {messages.map((message) =>
              <div key={message.sid}>
                <b>{message.author}</b>:{message.body}
              </div>)
            }
          </Box>
          <Input w="90%" autoFocus name="name" placeholder=""
                 onChange={(event) => setText(event.target.value)}
                 value={text}
                 onKeyPress={event => {
                   if (event.key === "Enter") sendMessage()
                 }}
          />
          <Button w="10%" onClick={sendMessage} disabled={!channel || !text}>Send</Button>
        </div>
      </Stack>
    </>
  );


}

