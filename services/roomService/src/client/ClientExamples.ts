import TwilioChat from '../lib/TwilioChat';

// It's OK to do console.logs here :)
/* eslint-disable no-console */

async function demoClient() {
  try {

    const client = await TwilioChat.getInstance();
    // const createChannelResponse = await client.createChannel('C6F14B12', nanoid(4));
    // console.log(createChannelResponse.sid);

    const channels = await client.getChannels();
    console.log(channels);

    // Function to delete all channels
    channels.forEach((channel) => {
      setTimeout( async () => {
        const res = await client.deleteChannel(channel.sid);
        console.log(res);
      }, 1000);
    });

    // await client.updateChannel('CHe7cd67f642044d19a56e463b3c66a659', 'UPDATED');
    // await client.sendInvite('CHe7cd67f642044d19a56e463b3c66a659', 'CALVIN');


    // await client.deleteChannel('CH2ad13231b31847e38cb0143de6d3d534');
    // await client.sendMessage('CH2ad13231b31847e38cb0143de6d3d534');
    //
    // const res = await client.updateChannel('CHf216ec47e8cc48ff8d5cf02fb15cc292', 'UPDATED CHANNEL NAME BY API');

    // client.deleteChannel('CHf725257f81bc446e9c5eac5556f3c2b8');
    // client.deleteChannel('CHfd9f57c04f314de290c5fddee0c9e919');



  } catch (err){
    console.trace(err);
  }
}

demoClient();

