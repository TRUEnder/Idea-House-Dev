const express = require('express')
const router = express.Router()

const bodyParser = require('body-parser')
router.use(bodyParser.urlencoded({ extended: false }))

const bcrypt = require('bcrypt')
const methodOverride = require('method-override')
router.use(methodOverride('_method'))

// Database Schema
const UserSchema = require('../models/userSchema')
const IdeaSchema = require('../models/ideaSchema')
const ProjectSchema = require('../models/projectSchema')
const LikeSchema = require('../models/likeSchema')

const initializePassport = require('../config/passport-config')
const passport = initializePassport(
    async (email) => { return await UserSchema.findOne({ email: email }) },
    async (id) => { return await UserSchema.findOne({ _id: id }) }
)

// Blocking direct access to page for authenticated user only
const blockForAuthenticated = require('../config/blockForAuthenticated')
const blockForNotAuthenticated = require('../config/blockForNotAuthenticated')

const { getUser } = require('../config/currentUser')



// Routing

router.get('/', blockForAuthenticated, async (req, res) => {
    const popularIdeas = await IdeaSchema.find().limit(4)

    const recentIdeas = await IdeaSchema.find().limit(4)

    const popularIdeaAuthor = []
    for (let i = 0; i < 4; i++) {
        let user = await UserSchema.findOne({ _id: popularIdeas[i].author })
        popularIdeaAuthor.push(user.name)
    }
    const recentIdeaAuthor = []
    for (let i = 0; i < 4; i++) {
        let user = await UserSchema.findOne({ _id: recentIdeas[i].author })
        recentIdeaAuthor.push(user.name)
    }

    res.render('index.ejs', { title: 'Idea House', popularIdeas, recentIdeas, popularIdeaAuthor, recentIdeaAuthor })
})

router.get('/what_we_do', (req, res) => {
    res.render('what_we_do.ejs', { title: 'What We Do - Idea House', req: req });
})

router.get('/register', blockForAuthenticated, async (req, res) => {
    res.render('register.ejs', { title: 'Register' })
})

router.get('/login', blockForAuthenticated, (req, res) => {
    res.render('login.ejs', { title: 'Login' })
})

router.post('/register', async (req, res) => {
    if (req.body.password !== req.body.password_confirm) {
        res.render('register.ejs', {
            title: 'Register',
            errorMessage: "Password confirmation doesn't match"
        })
    } else {
        const hashedPass = await bcrypt.hash(req.body.password, 10)
        const newUser = new UserSchema({
            name: req.body.name,
            email: req.body.email,
            password: hashedPass
        })

        try {
            await newUser.save()

            getUser(newUser._id).then(() => {
                res.redirect('/register/terms_and_conditions')
            })
        } catch (e) {
            if (e.message.slice(0, 6) == 'E11000') {
                res.render('register.ejs',
                    { title: 'Register', errorMessage: 'Email is already used' })
            } else {
                res.render('register.ejs',
                    { title: 'Register', errorMessage: 'Something went wrong. Please try again.' })
            }
        }
    }
})

router.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true
}),
    (req, res) => {
        getUser(req.user.id).then(() => {
            res.redirect(`/users/${req.user.id}/`)
        })
    }
)

router.delete('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(e)
        res.redirect('/')
    })
})

router.get('/register/terms_and_conditions', blockForAuthenticated, (req, res) => {
    res.render('terms_and_conditions.ejs', { title: 'Terms and Conditions' });
})

router.get('/idea_catalog', async (req, res) => {

    let category;
    switch (req.query.category) {
        case 'Home':
            category = 'Home & Kitchen';
            break;
        case 'IT':
            category = 'IT & Software';
            break;
        case 'Sport':
            category = 'Sport Utilities';
            break;
        default:
            category = req.query.category;
    }

    const page = req.query.page
    const pageSize = 10
    let numPage;
    let ideas;

    if (category == 'all') {
        numPage = Math.ceil(await IdeaSchema.estimatedDocumentCount() / pageSize)
        ideas = await IdeaSchema.find().skip((page - 1) * pageSize).limit(pageSize)

    } else {
        numPage = Math.ceil(await IdeaSchema.countDocuments({ categories: { $all: [category] } }) / pageSize)
        ideas = await IdeaSchema.find({ categories: { $all: [category] } }).skip((page - 1) * pageSize).limit(pageSize)
    }

    const ideasData = []
    for (let i = 0; i < ideas.length; i++) {
        const author = await UserSchema.findOne({ _id: ideas[i].author })
        const ideaData = {
            id: ideas[i]._id,
            title: ideas[i].title,
            authorName: author.name,
            created: ideas[i].created,
            modified: ideas[i].modified,
            label: ideas[i].label,
            categories: ideas[i].categories,
            content: ideas[i].content,
            thumbnail: ideas[i].thumbnail,
            thumbnail_desc: ideas[i].thumbnail_desc,
            like: ideas[i].like,
            views: ideas[i].views,
        }
        ideasData.push(ideaData)
    }

    res.render('idea_catalog.ejs', {
        title: category != 'all' ? `${category} - Idea Catalog` : 'Popular Idea - Idea Catalog',
        req,
        currCategory: req.query.category,
        page, numPage, ideasData
    })

})

router.get('/public/:authorId', async (req, res) => {
    const author = await UserSchema.findOne({ _id: req.params.authorId })
    const followerCount = await UserSchema.countDocuments({ follows: { $all: [author._id] } })

    let hasFollow = false
    if (req.isAuthenticated()) {
        const user = await UserSchema.findOne({ _id: req.user.id })
        if (user.follows != null) {
            hasFollow = user.follows.includes(author._id)
        }
    }

    const posts = await IdeaSchema.find({ _id: { $in: author.ideas } })

    const likedPosts = []
    const likedAuthor = []

    const allLikeFromAuthor = await LikeSchema.find({ user_id: author._id })
    if (allLikeFromAuthor != null) {
        for (let i = 0; i < allLikeFromAuthor.length; i++) {
            const idea = await IdeaSchema.findOne({ _id: allLikeFromAuthor[i].idea_id })
            likedPosts.push(idea)
            const author = await UserSchema.findOne({ _id: allLikeFromAuthor[i].user_id })
            likedAuthor.push(author)
        }
    }

    res.render('publicProfile.ejs', { title: `${author.name} - Profile`, req, hasFollow, author, likedPosts, likedAuthor, posts, followerCount })

})

router.use((req, res) => {
    res.statusCode = 404
    res.render('notFound.ejs', { title: '404 - Page not found', req: req })
})


module.exports = router
