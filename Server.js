import express from "express";
import BodyParser from "body-parser";
import env from "dotenv";
import pg from "pg";
import methodOverride from "method-override";

env.config();
const app = express();

app.use(methodOverride("_method"));
app.use(BodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


const port = 3000;
/*
const db = new pg.Client({
    user: process.env.DB_user,
    host: process.env.DB_localhost,
    database: process.env.DB_database,
    password: process.env.DB_password,
    port: process.env.DB_port
});
*/

const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,  // Neon connection string
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect();


app.get("/healthz", (req, res) => {
    const obj ={
        "ok": true,
        "version": "1.0.1"
    }
    res.send(JSON.stringify(obj));
})

// Dashboard
app.get("/", async (req, res) => {
    const result = await db.query("SELECT * FROM links");
    res.render("Main.ejs", { links: result.rows });
});

app.get("/api/links", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM links");
        res.status(200).json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).send("Server error");
    }
});

//check stats for single code
app.get("/code/:code", async (req, res) => {
    const code = req.params.code;
    try{
        const result = await db.query("SELECT * FROM links WHERE code = $1",[code] );

        if (result.rowCount === 0) {
            return res.status(404).send("Not found");
        }

        res.send(JSON.stringify(result.rows[0]));
    }catch(err){
        console.log(err);
        res.status(500).send("Server error");
    }

})

// Create link
app.post("/api/links", async (req, res) => {
    try {
        await db.query(
            "INSERT INTO links (code, url) VALUES ($1, $2)",
            [req.body.code, req.body.url]
        );
        res.redirect("/");
    } catch (err) {
        console.log(err);

        if (err.code === "23505") {  // Postgres unique violation
            return res.status(409).send("Shortcode already exists");
        }

    }
});

// Delete link
app.post("/api/links/:code", async (req, res) => {
    try {
        const result = await db.query(
            "DELETE FROM links WHERE code = $1",
            [req.params.code]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Shortcode not found");
        }

        res.redirect("/");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});


//redirect
app.get("/:code", async (req, res) => {

    const code = req.params.code;

    try {
        const result = await db.query("SELECT * FROM links WHERE code = $1", [code]);

        if(result.rows.length === 0) {
            return res.status(404).send("Shortcode not found");
        }

        await db.query("UPDATE links SET total_clicks = total_clicks + 1, last_clicked = NOW() WHERE code = $1", [code]);


        res.redirect(result.rows[0].url);



    }catch(err){
        console.log(err);
    }
})


app.listen(port, () => console.log("Server running"));
