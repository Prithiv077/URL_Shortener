const amqp = require("amqplib");
const pool = require("./db");

async function startWorker() {

    const connection =
        await amqp.connect("amqp://localhost");

    const channel =
        await connection.createChannel();

    await channel.assertQueue(
        "clicks",
        {
            durable: true
        }
    );

    console.log("Worker Started");

    channel.consume(
        "clicks",
        async (message) => {

            if (!message) return;

            const shortCode =
                message.content.toString();

            console.log(
                "Received:",
                shortCode
            );

            try {

                await pool.execute(
                    "UPDATE links SET clicks = clicks + 1 WHERE short_code=?",
                    [shortCode]
                );

                console.log(
                    "Updated:",
                    shortCode
                );

                channel.ack(message);

            }
            catch (err) {

                console.error(err);

            }

        }
    );

}

startWorker();