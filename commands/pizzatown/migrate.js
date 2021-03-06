const {Seller} = require("./models/Sellers")
const Advertiser = require("./models/Advertiser")
Seller.find().then(sellers => {
    sellers.forEach(async seller => {
        if(!seller.bathrooms) seller.bathrooms = 0
        if(!seller.sodaMachine) seller.sodaMachine = 0
        if(!seller.toppingBar) seller.toppingBar = 0
        if(!seller.playPlace) seller.playPlace = 0
        if(!seller.reviewScore) seller.reviewScore = 0
        if(!seller.topggVote) seller.topggVote = false
        if(!seller.votingStreak) seller.votingStreak = 0
        await seller.save()
    })
})

Advertiser.find().then(advertisers => {
    advertisers.forEach(async advertiser => {
        if(!advertiser.offices) advertiser.offices = 0
        if(!advertiser.offices2) advertiser.offices2 = 1
        if(!advertiser.airTime) advertiser.airTime = 0
        if(!advertiser.tvChannels) advertiser.tvChannels = 0
        if(!advertiser.employeeProduction) advertiser.employeeProduction = 0
        if(!advertiser.topggVote) advertiser.topggVote = false
        if(!advertiser.votingStreak) advertiser.votingStreak = 0
        await advertiser.save()
    })
})

