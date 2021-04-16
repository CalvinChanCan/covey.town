# Covey.Town

**Github Repo**: https://github.com/CalvinChanCan/covey.town

**Frontend**: https://covey-town.netlify.app/

**Backend**: https://covey-town-chat.herokuapp.com/

**Demo Video**: https://www.youtube.com/watch?v=vBhhDEgVA6Y

Covey.Town provides a virtual meeting space where different groups of people can have simultaneous video calls, allowing participants to drift between different conversations, just like in real life.
Covey.Town was built for Northeastern's [Spring 2021 software engineering course](https://neu-se.github.io/CS4530-CS5500-Spring-2021/), and is designed to be reused across semesters.
You can view our reference deployment of the app at [app.covey.town](https://app.covey.town/).

[comment]: <> (![Covey.Town Architecture]&#40;docs/covey-town-architecture.png&#41;)

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/chat-architecture.png" width="50%">

The figure above depicts the high-level architecture of Covey.Town.
The frontend client (in the `frontend` directory of this repository) uses the [PhaserJS Game Library](https://phaser.io) to create a 2D game interface, using tilemaps and sprites.
The frontend implements video chat using the [Twilio Programmable Video](https://www.twilio.com/docs/video) API, and that aspect of the interface relies heavily on [Twilio's React Starter App](https://github.com/twilio/twilio-video-app-react).

A backend service (in the `services/roomService` directory) implements the application logic: tracking which "towns" are available to be joined, and the state of each of those towns.

To read more about the design and architecture, please see the [DESIGN.md](/DESIGN.md)

## Running this app locally

Running the application locally entails running both the backend service and a frontend.

### Setting up the backend

To run the backend, you will need a Twilio account. Twilio provides new accounts with $15 of credit, which is more than enough to get started.
To create an account and configure your local environment:

1. Go to [Twilio](https://www.twilio.com/) and create an account. You do not need to provide a credit card to create a trial account.
2. Create an API key and secret (select "API Keys" on the left under "Settings")
3. Create a `.env` file in the `services/roomService` directory, setting the values as follows:

| Config Value              | Description                                   |
| ------------------------- | --------------------------------------------- |
| `TWILIO_ACCOUNT_SID`      | Visible on your twilio account dashboard.     |
| `TWILIO_API_KEY_SID`      | The SID of the new API key you created.       |
| `TWILIO_API_KEY_SECRET`   | The secret for the API key you created.       |
| `TWILIO_API_AUTH_TOKEN`   | Visible on your twilio account dashboard.     |
| `TWILIO_CHAT_SERVICE_SID` | Create a new API key under Programmable Chat.  |
| `TWILIO_AUTOPILOT_URL`    | Use the Autopilot feature to create a new bot and get a URL.   |

If there are any issues with getting the Twilio Autopilot to work, use our pre-configured backend endpoint for your frontend client:

``REACT_APP_TOWNS_SERVICE_URL=https://covey-town-chat.herokuapp.com/``


#### Getting a Twilio Chat Service SID

First click on the ellipse and then on the sidebar menu, click on "Programmable Chat". 
On the Programmable Chat Dashboard page, under "Chat Services", click the plus button to create a new Programmable Chat Service. 
An input box will appear to ask for a friendly name for the chat service. Enter a friendly name and click the "Create" button.
On the "Base Configuration" page, save the Service SID and set it to in your `.env` file as the `TWILIO_CHAT_SERVICE_SID`.

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/chat-1.png" width="75%">

#### Getting an Autopilot URL
First click on the ellipse and then on the sidebar menu, click on Autopilot.

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-1.png" width="50%">

Next, on the sidebar, click on "overview" and on the "Getting started with Autopilot" page, click on the button "Build from scratch"

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-2.png" height="50%">

Enter a unique name for the bot and click on "Create bot"

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-3.png" width="50%">

On the sidebar, under the bot's unique name you created, click on "Channels" and then click on "Programmable Chat"

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-4.png" width="50%">

Finally, under configuration, copy the "CHAT URL" and save it in your `.env` as `TWILIO_AUTOPILOT_URL=https://channels.autopilot.twilio.com/v1/...`

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-5.png" width="75%">

#### Configuring the bot

On the sidebar, click on the tasks and then click on the "Add a task" button.

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-6.png" width="50%">

On the task you just created, click "program". Here, you can enter in JSON format the response for the bot.
For example, to program a response, enter a response in "say" as seen the following example:

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-7.png" width="75%">
 

```json
{
	"actions": [
		{
			"say": "No information about you session or user data is saved."
		}
	]
}
```

Click the "save" button on the bottom. Then click "Switch to train chat". Here, in the input box under "What would people say to trigger the task", we can enter the keywords for the bot to look out for. Enter the keyword trigger and click "Add sample". Repeat this for all keywords for the response we set up earlier.

<img src="https://github.com/CalvinChanCan/covey.town/blob/master/docs/autopilot-8.png" width="50%">

Finally, click the "Build model" button on the bottom to build the bot.

To recreate our exact instance of our bot, repeat the above instruction and use [docs/chatbot/triggers.csv](/docs/chatbot/triggers.csv) which has a mapping of trigger words and responses as the tasks for the bot. 

### Starting the backend

Once your backend is configured, you can start it by running `npm start` in the `services/roomService` directory (the first time you run it, you will also need to run `npm install`).
The backend will automatically restart if you change any of the files in the `services/roomService/src` directory.

### Configuring the frontend

Create a `.env` file in the `frontend` directory, with the line: `REACT_APP_TOWNS_SERVICE_URL=http://localhost:8081` (if you deploy the rooms/towns service to another location, put that location here instead)

### Running the frontend

In the `frontend` directory, run `npm start` (again, you'll need to run `npm install` the very first time). After several moments (or minutes, depending on the speed of your machine), a browser will open with the frontend running locally.
The frontend will automatically re-compile and reload in your browser if you change any files in the `frontend/src` directory.
