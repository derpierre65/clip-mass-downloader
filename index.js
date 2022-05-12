const axios = require('axios');
const fs = require('fs');

const clipIds = fs.readFileSync('./clips.txt').toString().split("\n");
const gqlData = [];

for (const clipId of clipIds) {
	gqlData.push({
		operationName: 'VideoAccessToken_Clip',
		variables: {
			slug: clipId
		},
		extensions: {
			persistedQuery: {
				version: 1,
				sha256Hash: '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11',
			},
		},
	});
}

axios
	.post('https://gql.twitch.tv/gql', gqlData, {
		headers: {
			'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
		},
	})
	.then(({ data }) => {
		for (const [key, entry] of data.entries()) {
			const clip = entry.data.clip;
			let bestQuality = 0;
			let qualityIndex = -1;

			for (const [videoKey, videoQuality] of clip.videoQualities.entries()) {
				const thisQuality = parseInt(videoQuality.quality);
				bestQuality = Math.max(thisQuality, bestQuality);

				if (bestQuality === thisQuality) {
					qualityIndex = videoKey;
				}
			}

			if (qualityIndex === -1) {
				console.error('No video quality found for ', clip);
				continue;
			}

			const downloadUrl = clip.videoQualities[qualityIndex].sourceURL + '?sig=' + clip.playbackAccessToken.signature + '&token=' + encodeURIComponent(clip.playbackAccessToken.value);

			if (!fs.existsSync('./clips')) {
				fs.mkdirSync('./clips');
			}

			const writer = fs.createWriteStream('./clips/' + clipIds[key] + '.mp4');

			axios
				.get(downloadUrl, { responseType: 'stream' })
				.then(({ data }) => {
					return new Promise((resolve, reject) => {
						data.pipe(writer);
						let error = null;
						writer.on('error', (err) => {
							this.log('error', 'Download failed', err);

							error = err;
							writer.close();
							reject(err);
						});
						writer.on('close', () => {
							if (!error) {
								console.log(`Download ${clipIds[key]} completed.`);
								resolve();
							}
						});
					});
				})
				.catch(() => {
					console.log(`Download ${clipIds[key]} failed.`);
				});
		}
	});