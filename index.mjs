import AWS from 'aws-sdk';
import sharp from 'sharp';

export const handler = async (event, context) => {
    try {
        const expectedBucket = 'onedata-receive-images-to-crop';
      
        const s3Event = event.Records[0].s3;
        const bucket = s3Event.bucket.name;
      
  
        if (bucket === expectedBucket) {
            const key = s3Event.object.key;

            const s3 = new AWS.S3();
            const params = {
                Bucket: bucket,
                Key: key,
            };

            const imageObject = await s3.getObject(params).promise();
            const imageBuffer = imageObject.Body;
            
            let aspectRatioString;
            if (key.includes('1920_1080')) {
                aspectRatioString = '16/9';
            } else if (key.includes('720_1080')) {
                aspectRatioString = '2/3';
            } else if (key.includes('810_1080')) {
                aspectRatioString = '3/4';
            } else {
                console.log('Image size not recognized. No cropping applied.');
                
                await s3.putObject({
                    Bucket: newBucket,
                    Key: key,
                    Body: imageBuffer,
                }).promise();

                return
            }

            const croppedImageBuffer = await cropImage(imageBuffer, aspectRatioString);

            const newBucket = 'onedata-receive-images';

            await s3.putObject({
                Bucket: newBucket,
                Key: key,
                Body: croppedImageBuffer,
            }).promise();

            console.log('Cropped image has been successfully saves in bucket:', newBucket);

        }
  
      return {
        statusCode: 200,
        body: JSON.stringify('Successfully'),
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify('Error'),
      };
    }
};
  

async function cropImage(inputImageBuffer, aspectRatioString) {
    const [width, height] = aspectRatioString.split('/').map(Number);

    const imageInfo = await sharp(inputImageBuffer).metadata();

    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;

        
    if (Math.round(originalWidth / width) === Math.round(originalHeight / height)) {
        console.log("The image already has the correct aspect ratio. We don't do anything.");
        return inputImageBuffer
    }

    let newWidth, newHeight;
    if (originalWidth / width > originalHeight / height) {
        newWidth = Math.round(originalHeight * width / height);
        newHeight = originalHeight;
    } else {
        newWidth = originalWidth;
        newHeight = Math.round(originalWidth * height / width);
    }

    const topOffset = Math.max(0, Math.floor((originalHeight - newHeight) / 2));
    const leftOffset = Math.max(0, Math.floor((originalWidth - newWidth) / 2));

    const croppedImageBuffer = await sharp(inputImageBuffer)
        .extract({
            top: topOffset,
            left: leftOffset,
            width: newWidth,
            height: newHeight
        })
        .toBuffer();

    return croppedImageBuffer;
}

