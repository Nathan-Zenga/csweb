const fs = require('fs'); // core module
const ytdl = require('ytdl-core');
const { v2: cloud } = require('cloudinary');
const { Homepage_image } = require('../models/models');
const mongoose = require('mongoose');

mongoose.connect(process.env.CSDB).then(async ({ connection }) => {
    const basepath = "./public/media";
    const file = basepath + "/homepage-bg-vid-1.mp4";
    const media = await Homepage_image.find({ p_id: { $regex: /^homepage\/videos/ } });

    await cloud.api.delete_resources(media.map(m => m.p_id)).catch(e => e);
    await Homepage_image.deleteMany({ _id: { $in: media.map(m => m.id) } });
    console.log("Removing media directory...");
    fs.rm(basepath, { recursive: true, force: true }, async err => {
        if (err) { console.error(err.message); return await connection.close() }

        fs.mkdirSync(basepath);
        const url = "https://www.youtube.com/watch?v=rCLf32SexXQ";
        const videoID = ytdl.getURLVideoID(url);
        const info = await ytdl.getInfo(videoID);
        const format = ytdl.chooseFormat(info.formats, { filter: fmt => fmt.initRange && fmt.indexRange && fmt.hasVideo, quality: "highest" });
        const stream = ytdl(url, { format }).pipe(fs.createWriteStream(file));
        console.log("Homepage media uploading...");

        stream.on("error", async err => { console.error(err.message); await connection.close() });

        stream.on("ready", () => { console.log("Piping...") });

        stream.on("finish", async () => {
            const media = await Homepage_image.find({ p_id: { $regex: /^homepage\/videos/ } });
            const public_id = `homepage/videos/homepage-bg-vid-${media.length + 1}`;
            const result = await cloud.uploader.upload(file, { public_id, resource_type: "video" });
            await Homepage_image.create({ p_id: result.public_id, url: result.secure_url, index: media.length + 1 });
            console.log("Done... homepage media uploaded");
            await connection.close();
        });
    });
});
