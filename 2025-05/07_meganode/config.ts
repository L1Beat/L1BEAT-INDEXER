import pLimit from 'p-limit';
import pThrottle from 'p-throttle';
import { fetchAllChains, getCurrentValidators } from "./rpc"

const validatedSubnets = [
    "qCccbQ4CJekniXpdgfdoFinEAkUf4wys9T89JNTK9CuvcMW81",
    "2hBZBRc7SraKnT3AkPiCByYTFtWh6wKZViJ8QJpCjYhLyLCmQR",
    "VsxF67NQTACc2fLQL9fD3F8LzJ5eezcSGFNitGsk7VxKbPwcD",
    "25HsT5NZw5hrCZBgi7zqafWXyDqbU3yCV4xuA593qU54XQecy4",
    "nWsbPVjZcdAYRkxPMDyNmDp5eBQCby5LwLu6KzC9VCjk4bp5j",
    "23dqTMHK186m4Rzcn1ukJdmHy13nqido4LjTp5Kh9W6qBKaFib",
    "3inyDoxM3Wksbxbo1oRXvxLKHyxK98XZYww5AknyapjfhQoRT",
    "kf1sMrGJSA2x9yZfvjBJCHu3ZdTievrCyrbEEPKXbHMH2tXuA",
    "WChFQ1twkXBLxZGo4qojC9AgizFrRdMRnPCK9FZmisY7z6pUs",
    "2Dt7yXBvYHh6uqExB476ZTLWkVmaqzxkGSzCXxsRHMwDMVzw6m",
    "QNCJ233aLWzubBViquKQCiY2JU2R6NDqUUwLtG6ax87S8UJCm",
    "H8BEmxqhT23bEr9R6Cg5zfaXt1bKHLS9SzVeFo57FSqeZDu5Y",
    "yD6k6gVKmzFbefPcdYjsJz17KVQFSivTR1emJ5cTBvq2d8MRg",
    "5vcCHz5fgd1hWyXaKiLnMAVjmh4qW7yFxNbASBjxCXZYE445N",
    "2LbGgyVZE5aMMYPp3h1F2MkKbjefR51nSZWaZzarDZf8GThCcX",
    "2wKKYiv2EkZJKMoriJuqkcasEtLoqQk3fa3garx7PAGJojjMdn",
    "R2iSZc3NucxEtEbj7vEs42jf5zngTsjCEaUAqyEYYYGSmq3Jc",
    "LXTDJCc8UPUcMpAmn958ExfTyzR5CRTNtTw8x175E4P7htoDH",
    "h7egyVb6fKHMDpVaEsTEcy7YaEnXrayxZS4A1AEU4pyBzmwGp",
    "2sF5Pb165jhdeNSy2kT4WyDYazu3buh1WGh77oTBA9dDjBPtsy",
    "TfTBHvcxpBfxPntMpadskcZTH8AG5rgkrNyz2DzeByNMsZkMo",
    "o4Eariv2Cx1fTvPFXYofpJfS9KgwFaiGN8KFGcCeZM9t87GJr",
    "2ocjsdpN9czPYmHqS4Tc5Aydj4zk2WWVdX9jdXtqvMjQuf9pgV",
    "6uH9zL2ZhPLWB1W1qodgRRm42YfLWdPKtQe2xzAWjr5TAhkmm",
    "2TqrQau4E99KoUXcFjyf1Pek3rUHpDpqtN9rC5GDaCKFu7dfPo",
    "hbP3PrnQS71Py1VVxvHfnCnr7MWos3XQesEsCKQoA9hpciyVR",
    "2rQ8M43c9NTv1545VsTunmY95m8QLw8koNYawuTnMtDf97im99",
    "2JzTHmoPJr1qSF1gTCirdKnVV913daTYmu33yyGucK4fqqXC5X",
    "j6HXQWdpRhX7yHMWLehUyYDjypHa455vP5tuiXZ81nkPgveFV",
    "dvqEJ3jJQmQ1N7ykvqq6TWyKu47q4yXmdZqaeMo6795GZmHUf",
    "2LQHZFVXCLNwxn8aYbE5sbH5ALorbUWid7metpFqkwBKWcwhbf",
    "jmLmezoViv3F72XLzpdmSNk3qLEGb72g5EYkp3ij4wHXPF2KN",
    "2LyJdHSdQDwg84nrbLrmtvEoAuudg41dWnhrbjMQUq78bdDHnT",
    "pchqewRRQHwx1B3XJEq9p2HGSdjrHsyv48YzVUWXZbrmH4TM6",
    "2ZKrfJUwXDsp27ggtxTqhWnzV87GpHppu2XJsv2nmFkHefHZZ5",
    "B7hA9WibSJu2fKdHT2XZs2RYg1rZTtxwg6cMYBKYjvcJjbqsp",
    "2Mi7V6HwKCEPxXTRG87o5tHACECkMPnJKP6UA3w1ote7j46GYT",
    "2vL4TMT23mZzTsdkSSMFWZArFNWskR3xRWvCLxdrgd4rCe6vVy",
    "2MbQjnTg3yxEtZBfnamboi7K9AajwNq7WExiwReBQSBtwbBVer",
    "2MFMK4igZd3bL133TE8qao9QTKi56s2AK83yTL2hE9JYkZde5U",
    "2H1TLFqf4y1rbcdC9R6iaospSLuDQVkjhYzZ5Vy2gCNGkubXqp",
    "x1C95jnFyLV3x8tiiCW7ZFRoRFgq9SX1Yprwfxx4GCTujggYB",
    "hqqtt4VGmzSACDn2yYxTFMhHu9RpFTECEhbexb4bXu2w6Pxtf",
    "2np4VHz1c31SjmiMmtSZ27VswzDhKZThznVRXX9AzkD37BKfNx",
    "2nCzBViQ5jxLaxkg9TABx6oXu1UGU7chM7G6XzPvW9ehP8RfrJ",
    "2jSd7RdKVoqVQoUjuvJBuMPancYJ3CUcLLdqfu6RFocHyxxEQh",
    "q54cgHa9RN2NFp9qsfpPzVkhgn8xqDgKEQR1G997xZ1P5Dc8o",
    "63toLWYNBLvCZvYqRArcVo6jxv2PUPRWM39pRc34ffGTe2bPu",
    "2r7mmEKg3R2gTD22TtErn8KD8TmLeSjVXHdwMpH2S9BESUxH7q",
    "2Y83BEXg7zgSCJunL2KD2i1vjMfaMnU1QEpG4M7acqG44BnRto",
    "2eq3DtJp4cWzvGd8Q3ZFo8VpZmmD235Xoxgq6CmX8anZ69M54",
    "gdZCkuVbt6QmTdgQ4z9Y3dcooTy12UuyFZq7bKs83TmvG5fAz",
    "28NfaGpEddtjPESwKyjns6MJB91bvCHoAp3UsuY2PZWK2jrkxe",
    "5moznRzaAEhzWkNTQVdT1U4Kb9EU7dbsKZQNmHwtN5MGVQRyT",
    "GSkwV1pXkrm3f9e79f16x3PjJKHvBFDd5Fe1CSBWPEEQCJfTf",
    "25Z5KLaGqNaUB5Gmo5BADwEDokTPJLvJJK3mNQCVUZmrvs9jYf",
    "28E5rVqxKdZVzwP8LBm2v6EBFZJGtUBbVKZp3Y947Cmr2H7Pog",
    "Cvoddysz7vrgicTjhiuFtEZ7FMzCVDDzwDv5Dd4XBrjAvnGK2",
    "2PkFwku54MGMqUuwWwiEnt5pgWE51DHQW9hAePbsnPdxAbtiG",
    "JYiYv9f6cRgsJNMACbd6fZGVvbxfN2R6NfVPHnvHBuP3vnDNb",
    "2vbUo9xZZJ6wH1BZvzTA468EW9CjyytQ3xXawGCttUBmeinjqY",
    "d4yfvAkTtX8PhSSfCCD8YBi4Ywi9CnwovANE2fYXFwyNhnKW6",
    "XhmT4AZNRKPF7fo2N6xGdecscPTCGvCsPMXm2iziPFBNJt5Qm",
    "29S6KxsHd6ACnRkMsFtvoXLdd7bZraKntBya6UVg6vkdLKBYEo",
    "hsjD1R3419hb2WpUryiipaVhTTKW37s9BrPi1Rk3eWS1Vc9fr",
    "JD8MbaUp75twdVJ7A4j2ryk7gFJ8FCgQeNLhvDv3y4up9bExp",
    "oAs71UMyGBFs6k5S3NY4NG8FKGnpSbaRhBovS2pckT7C3qzXa",
    "8memoZjjcw3PoJzr8DSUorQkr45DqgEvakLA41tfuj121ziMu",
    "BsiGLLVzkFm8Gbc4B6LqVKhLi68tLWmvavmiTwr2t2s7qZNgB",
    "2tbRjpEFpbCSk5eZF6vXBbpw16jZnJmZok9sEW9HF7oaSGzXca",
    "2LW4YokoP5rLCAaHk4tt85JM8V4qiHc8CWDdG1mGo9FqHFfWAJ",
    "bd4FY16fF5pd7iscMFTtb214Yya1kbrLow1XMyNeb3ZY3fFXA",
    "vGJi918DpSjsjC4DaGfdfgSZTCJQeSfDCzAkdPEwTeQjvjLQX",
    "22JVyUQPXbum5pK9WqC92Qyz9cmwW11MmKXAGn4m3G5TGBvDxd",
    "Eax96S3KFyMs1CpgdmuJjzR1DngU8iKR8j7ugJmx2fvLyANf8",
    "2E51RZFicF5EMNiERg3dySkpcjoz4YaobASeqEdbEpiHsSRHrX",
    "2P3HrSbCPje8AWVDQU3rQLdYcojbnXh4NAAJRYmSC2VzZpWZ6x",
    "2r2fWaWN1pxNrkFzePGzVHc6R9uRuRkn39Gifu5kmQS5U5gn2Y",
    "21Sa545TimmWaJabL4P5hXmaRfTtPxbfjWTHbWYN9E1Ri2AakE",
    "2qJPnDkDH6hn3PVzxzkUdTqDD1HeAnTT8FL4t2BJagc2iuq8j7",
    "26wQKuvA5kjwrKDaje7nmuJAx6Ke2bGvDDr3EiypNr53rH1pMc",
    "LbvSkGmUJSpUby1gUrk4g9mmdeZQWcVGiFCXv57CJHBrxxEos",
    "29p4FdSKaXQPyw8sqhzJSK37FXuPHdyECau186qZSUNRhk3QuB",
    "2sDjh95i88VY4oi3eACYBxHTY6poZs71yKC71jhzgYBJY5hrCs",
    "2UPuVAx5yFubvDPm6CYywT4mYAdTW3zM1XXD7R7ic8s2zQhF8U",
    "axp7DUSPvFghTM883ug2B8btAReBAACxD1VyENmRDStH4Lfed",
    "hkugVjqegihrQcggCnScNW8yQctyY7Z7oj2Mj5tGxWGXNa5iQ",
    "2W9sERL7Zf7NrWpz7Bzg3fKSEt46gSQaKAU7ntTMSShLy64yMz",
    "oerPWBbtbe13eWbo3AegYUrHuSETeTwyNy7szoHJJ1QQBL9nu",
    "2hoHzxcZktxrTNoqCZhR9bEctc5oCuBqSp6SpRn6uvwxzLkvnD",
    "27mZh9HyNwGdqfkQDWabzo9BonhPSzh1qwdzaDsmPJDn1woCVV",
    "2T4gpnissLkoezQ36XKxhrFAH5yynqKGa1u47XxCYTdfvePuNz",
    "2hZa4RMWAkiQAQ5zpbPSkNziYSHyCqBGeKNnbqWfJL2GKmy8eq",
    "4iDWVgCCSu4Tafpg4bdhxu8q1ap8Rp2hMzG4UPxUhL9UVX6iU",
    "nKJuE11HePLrmp391sfoFVqZR7Fw5VJ1XjyznsogsjebxwiAg",
    "23LsHpx3wTPtNC4PUaTdtNQkaGbLxwiGimnZjHaUc28qLHs7Dn",
    "yPUx56ffTBML1QfomcBvwfBxfE3LSgqkBNfxTCpx5dr4NNFGB",
    "2kyZRnEHakKriNufphojbeFR5hi247bJeTjFDgQgo7VRRjoqyq",
    "2v7aLktZroWTwcSPHkN6gSDjzJCDuAsHhHpRZTMKiqnegwG6sL",
    "qWeo55RT2F7SNoWtVUuAGptPoz23hViLthjHHaj3BsV2pv7TM",
    "LThVFg2aFviak8Ranf8nNX4UAEtLyzhyCNY2AQdXbgYkJdQTM",
    "eYwmVU67LmSfZb1RwqCMhBYkFyG8ftxn6jAwqzFmxC9STBWLC",
    "2wLe8Ma7YcUmxMJ57JVWETMSHz1mjXmJc5gmssvKm3Pw8GkcFq",
    "yDxaSh2hoVxQKRHmacV1xFpuSgHf6Q6cCMu4v3GoLQnqQWk6L",
    "Cv1gyKNUtPNAtFw8YcjbsD4a3HNRbNvinY7t2gnGK4J54rQK3",
    "nQCwF6V9y8VFjvMuPeQVWWYn6ba75518Dpf6ZMWZNb3NyTA94",
    "2UEGsEEjRyMSgD7cNufCGEXbPXsma7RctBgfRw3Haqkk8oByFa",
    "9ewhue9Lyryt1G4H1icgZotc6wRVwiPgmiVemSN24JXwg91JH",
    "2gHgAgyDHQv7jzFg6MxU2yyKq5NZBpwFLFeP8xX2E3gyK1SzSQ",
    "ii7zCu8JNnYYgPT8PwpVYiTS1gcK5RWJfsyuPXTDv8Bn9wspY",
    "DxanjptkyaeM1eUew2gzUMngHM3n5ttUyMj7BuHw9riXh9pJC",
    "wenKDikJWAYQs3f2v9JhV86fC6kHZwkFZsuUBftnmgZ4QXPnu",
    "7f9jciLEX25NPJEaAz1X7XF44B1Q9UBwq6PdnCHm5mnUq1e1C",
    "Vn3aX6hNRstj5VHHm63TCgPNaeGnRSqCYXQqemSqDd2TQH4qJ",
    "11111111111111111111111111111111LpoYY",
    "2QRKgBVT4zbcEWM4aXYRPNRazmas9on1QZodYakh1cF4RDrQE5",
    "2FKZhsPScXjdoAqL6xf9z7Vgqyh3yRpkFFGeLTQfDeQ6JZzyEB",
    "91HAifNFJZq1TaiurGA8jaFGnbA7pkYzJ3kcDSSEJarRwAt56",
    "wuCkRgTHeMZyj7KCiQDpNZoAmFduLx8KRwNxzJYaK7RzVGR6z",
    "2SWquk5bfTpXLrBihfFVLmg4QksBNAuDfFASAZbT2cHmbeaaQv"
]

export const subnetIds = Array.from(validatedSubnets).filter(subnetId => subnetId !== "11111111111111111111111111111111LpoYY")
console.log(JSON.stringify(subnetIds, null, 2))

// Uncomment to add new subnets to the list
const fromGlacier = await getValidatedSubnetsFromGlacier()
let hasNew = false
for (const subnetId of fromGlacier) {
    if (!subnetIds.includes(subnetId) && subnetId !== "11111111111111111111111111111111LpoYY") {
        console.log(`New subnet: ${subnetId}`)
        hasNew = true
    }
}

if (hasNew) {
    process.exit(1)
}

async function getValidatedSubnetsFromGlacier() {
    const allChains = await fetchAllChains()

    console.log(`Found ${allChains.length} chains`)

    const validatedSubnets: Set<string> = new Set()
    const unvalidatedSubnets: Set<string> = new Set()

    const limit = pLimit(5);
    const throttle = pThrottle({
        limit: 10,
        interval: 1000
    });

    const throttledGetValidators = throttle(getCurrentValidators);

    let completed = 0
    async function checkValidated(chainId: string, subnetId: string) {
        if (chainId === "11111111111111111111111111111111LpoYY") {
            return
        }
        const validators = await throttledGetValidators(subnetId)
        if (validators.length > 0) {
            validatedSubnets.add(subnetId)
        } else {
            unvalidatedSubnets.add(subnetId)
        }

        completed++
        console.log(`Completed ${completed} of ${allChains.length} chains`)
    }


    await Promise.all(allChains.map(chain => limit(() => checkValidated(chain.blockchainId, chain.subnetId))))

    return Array.from(validatedSubnets)
}
