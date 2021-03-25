import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Channel} from 'twilio-chat/lib/channel';
import {Box, Button, Input, Stack} from "@chakra-ui/react";
import {Message} from 'twilio-chat/lib/message';
import useCoveyAppState from "../../hooks/useCoveyAppState";

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
  const {userName} = useCoveyAppState();

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
      thisChannel.on("messageAdded", handleMessageAdded);
    }

    handleChannel();
    return () => {
      isMounted = false
    };
  }, [thisChannel])

  // helper useEffect for debug checking what message objects look like.
  useEffect(()=>{
    console.log(messages);
  },[messages])


  // Sends the message to channel and handles text displayed in input box.
  const sendMessage = async() => {
    if (text && String(text).trim()) {
      setLoading(true);
      
      // provide send message with an attribute that is a string
      await channel.sendMessage(text, userName); 
      // channel.sendMessage(text);
      setText("");
      setLoading(false);
    }
  };

  const renderMessage = messages.map(message=>{
      const { attributes } = message;
      const string = attributes.toString();
      return (<div key={message.sid}>
        <b>{string}</b>:{message.body}
      </div>)
    })
  
  

  return (
    <>
      <Stack>
        <div ref={messagesEndRef}>
          <Box maxH="500px" overflowY="scroll">
            {renderMessage}
          </Box>
          <Input w="90%" autoFocus name="name" placeholder=""
                 onChange={(event) => setText(event.target.value)}
                 value={text}
                 onKeyPress={event => {
                   if (event.key === "Enter") sendMessage()
                 }}
          />
          <Button w="10%" onClick={sendMessage} disabled={!channel || !text} isLoading={loading}>Send</Button>
        </div>
      </Stack>
    </>
  );


}

