const express = require("express")
const cors = require("cors")
const { Client } = require("pg")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const WebSocket = require("ws")
const fs = require("fs/promises")
const multer = require("multer")
const exec = require("child_process").exec

// FFMPEG

const convertImageToPng = (path) => {
    // exec(`ffmpeg -i ${path} ${path}.png`, (error) => {
    //     if (error) {
    //         throw error
    //     }
    // })


    exec(`mv ${path} ${path}.png`, (error) => {
        if (error) {
            throw error
        }
    })
}

// Database connecting

const db = new Client({
    host: "aws-0-eu-central-1.pooler.supabase.com",
    password: "207d519bbb574a4e9b17d1a0a9495200",
    database: "postgres",
    user: "postgres.qsmhxtpnhtzwpumocxns"
})

db.connect().then(() => {
    console.log("DB connected!")
})

// Connecting to a broadcast server

const broadcastWS = new WebSocket("ws://cha4-broadcast.onrender.com")

broadcastWS.on("error", console.error)

broadcastWS.on("open", () => {
    broadcastWS.send({ event: "auth", data: jwt.sign("http server", privateKey) })
})

broadcastWS.on("message", async (msg) => {
    switch (msg.event) {
        case "message":
            await db.query(`insert into messages values (default, ${msg.data.message}, ${msg.data.type}, ${msg.data.username}, ${msg.data.date}`)
    }

})

// Initializing express app

const app = express()
const PORT = process.env.PORT || 10000
const privateKey = process.env.PRIVATE_KEY
const salt = 10

app.use(cors())
app.use(express.json())

// Middlewares

const checkQueryParams = (params) => {
    return (req, res, next) => {
        for (let param of params) {
            if (!req.query.hasOwnProperty(param)) {
                res.statusMessage = `This request must contain query param ${param}`
                res.sendStatus(400)
                return
            }
        }

        next()
    }
}

const checkBodyParams = (params) => {
    return (req, res, next) => {
        for (let param of params) {
            if (!req.body.hasOwnProperty(param)) {
                res.statusMessage = `This request must contain body param ${param}`
                res.sendStatus(400)
                return
            }
        }

        next()
    }
}

const checkAuthorized = (req, res, next) => {
    const authorization = req.header("Authorization")

    if (!authorization) {
        res.sendStatus(401)
        return
    }

    const authArray = authArray.split(" ")

    if (authArray[0] !== "bearer") {
        res.sendStatus(401)
        return
    }

    try {
        jwt.verify(authArray[1], privateKey)
    } catch (err) {
        res.sendStatus(401)
        return
    }

    next()
}

const imagesUpload = multer({ dest: "./data/images/" })

// Get requests

app.get("/api/messages*", async (req, res) => {
    try {
        let page

        if (req.query.hasOwnProperty("page")) {
            page = req.query.page
        } else {
            page = 0
        }

        const messages = await db.query(`select * from messages order by date desc limit 50 offset ${50 * page}`)

        res.send(messages.rows)
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})

app.get("/api/images*", checkQueryParams(["id"]), async (req, res) => {
    try {
        const path = "./data/images/" + req.query.id + ".png"

        try {
            await fs.access(path)
        } catch {
            res.statusMessage = "There is not image with this id"
            res.sendStatus(404)
            return
        }

        res.sendFile(__dirname + "data/images/" + req.query.id + ".png")
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})

// Post requests

app.post("/api/login", checkBodyParams(["username", "password"]), async (req, res) => {
    try {
        const users = await db.query(`select * from users where username='${req.body.username}'`)

        if (users.rowCount == 0) {
            res.statusMessage = "User with such username isn't exists"
            res.sendStatus(400)
            return
        }

        const user = users.rows[0]

        const goodPassword = await bcrypt.compare(user.password_hash, req.body.password)

        if (!goodPassword) {
            res.statusMessage = "Invalid password"
            res.sendStatus(400)
            return
        }

        res.send(jwt.sign({ username: req.body.username }, privateKey))
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})

app.post("/api/register", checkBodyParams(["username", "password"]), async (req, res) => {
    try {
        const users = await db.query(`select * from users where username='${req.body.username}'`)

        if (users.rowCount != 0) {
            res.statusMessage = "User with such username is already exists"
            res.sendStatus(400)
        }

        const passwordHash = await bcrypt.hash(req.body.password, salt)

        await db.query(`insert into users values (default, '${req.body.username}', '${passwordHash}')`)
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})

app.post("/api/images", imagesUpload.single("image"), async (req, res) => {
    try {


        convertImageToPng(req.file.path)

        res.send(req.file.filename)
    } catch (e) {
        console.error(e)
        res.sendStatus(500)
    }
})

app.listen(PORT, () => {
    console.log("Server started on port", PORT)
})

