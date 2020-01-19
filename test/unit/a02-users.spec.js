const testUtils = require('../utils')
const rp = require('request-promise')
const assert = require('chai').assert
const config = require('../../config')

const util = require('util')
util.inspect.defaultOptions = { depth: 1 }

const LOCALHOST = `http://localhost:${config.port}`

const context = {}

describe('Users', () => {
  before(async () => {
    // console.log(`config: ${JSON.stringify(config, null, 2)}`)

    // Create a second test user.
    const userObj = {
      email: 'test2@test.com',
      password: 'pass2'
    }
    const testUser = await testUtils.createUser(userObj)
    // console.log(`testUser2: ${JSON.stringify(testUser, null, 2)}`)

    context.user2 = testUser.user
    context.token2 = testUser.token
    context.id2 = testUser.user._id

    // Get the JWT used to log in as the admin 'system' user.
    const adminJWT = await testUtils.getAdminJWT()
    // console.log(`adminJWT: ${adminJWT}`)
    context.adminJWT = adminJWT

    // const admin = await testUtils.loginAdminUser()
    // context.adminJWT = admin.token

    // const admin = await adminLib.loginAdmin()
    // console.log(`admin: ${JSON.stringify(admin, null, 2)}`)
  })

  describe('POST /users', () => {
    it('should reject signup when data is incomplete', async () => {
      try {
        const options = {
          method: 'POST',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          body: {
            email: 'test2@test.com'
          }
        }

        let result = await rp(options)

        console.log(`result stringified: ${JSON.stringify(result, null, 2)}`)
        assert(false, 'Unexpected result')
      } catch (err) {
        if (err.statusCode === 422) {
          assert(err.statusCode === 422, 'Error code 422 expected.')
        } else if (err.statusCode === 401) {
          assert(err.statusCode === 401, 'Error code 401 expected.')
        } else {
          console.error('Error: ', err)
          console.log('Error stringified: ' + JSON.stringify(err, null, 2))
          throw err
        }
      }
    })

    it('should sign up', async () => {
      try {
        const options = {
          method: 'POST',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          body: {
            user: { email: 'test3@test.com', password: 'supersecretpassword' }
          }
        }

        let result = await rp(options)
        // console.log(`result: ${JSON.stringify(result, null, 2)}`)

        context.user = result.body.user
        context.token = result.body.token

        assert(result.statusCode === 200, 'Status Code 200 expected.')
        assert(
          result.body.user.email === 'test3@test.com',
          'Email of test expected'
        )
        assert(
          result.body.user.password === undefined,
          'Password expected to be omited'
        )
        assert.property(result.body, 'token', 'Token property exists.')
        assert.property(result.body.user, 'type')
        assert.property(result.body.user, 'apiLevel')
        assert.property(result.body.user, '_id')
        assert.property(result.body.user, 'bchAddr')
        assert.property(result.body.user, 'hdIndex')
      } catch (err) {
        console.log(
          'Error authenticating test user: ' + JSON.stringify(err, null, 2)
        )
        throw err
      }
    })
  })

  describe('GET /users', () => {
    it('should not fetch users if the authorization header is missing', async () => {
      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json'
          }
        }

        await rp(options)

        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should not fetch users if the authorization header is missing the scheme', async () => {
      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: '1'
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should not fetch users if the authorization header has invalid scheme', async () => {
      const { token } = context
      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Unknown ${token}`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should not fetch users if token is invalid', async () => {
      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer 1`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should throw 401 if non-admin getting users', async () => {
      const { token } = context

      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        // console.log(`err: `, err)
        assert.equal(err.statusCode, 401)
      }
    })

    it('should get all users if admin', async () => {
      const options = {
        method: 'GET',
        uri: `${LOCALHOST}/users`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${context.adminJWT}`
        }
      }

      const result = await rp(options)
      const users = result.body.users
      // console.log(`users: ${JSON.stringify(users, null, 2)}`)

      assert.isArray(users)
    })
  })

  describe('GET /users/:id', () => {
    it('should not fetch user if token is invalid', async () => {
      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer 1`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should throw 401 if non-admin getting other user', async () => {
      const { token } = context

      try {
        const options = {
          method: 'GET',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should fetch user', async () => {
      const {
        user: { _id },
        token
      } = context

      const options = {
        method: 'GET',
        uri: `${LOCALHOST}/users/${_id}`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const result = await rp(options)
      const user = result.body.user
      // console.log(`user: ${util.inspect(user)}`)

      assert.hasAnyKeys(user, ['type', '_id', 'email'])
      assert.equal(user._id, _id)
      assert.notProperty(
        user,
        'password',
        'Password property should not be returned'
      )
    })
  })

  describe('PUT /users/:id', () => {
    it('should not update user if token is invalid', async () => {
      try {
        const options = {
          method: 'PUT',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer 1`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should throw 401 if non-admin updating other user', async () => {
      const { token } = context

      try {
        const options = {
          method: 'PUT',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should update user', async () => {
      const {
        user: { _id },
        token
      } = context

      const options = {
        method: 'PUT',
        uri: `${LOCALHOST}/users/${_id}`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: {
          user: { email: 'testToUpdate@test.com' }
        }
      }

      const result = await rp(options)
      const user = result.body.user
      // console.log(`user: ${util.inspect(user)}`)

      assert.hasAnyKeys(user, ['type', '_id', 'email'])
      assert.equal(user._id, _id)
      assert.notProperty(
        user,
        'password',
        'Password property should not be returned'
      )
      assert.equal(user.email, 'testToUpdate@test.com')
    })

    it('should not be able to update user type', async () => {
      try {
        const options = {
          method: 'PUT',
          uri: `${LOCALHOST}/users/${context.user._id.toString()}`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Authorization: `Bearer ${context.token}`
          },
          body: {
            user: {
              name: 'new name',
              type: 'test'
            }
          }
        }

        let result = await rp(options)

        // console.log(`Users: ${JSON.stringify(result, null, 2)}`)

        assert(result.statusCode === 200, 'Status Code 200 expected.')
        assert(result.body.user.type === 'user', 'Type should be unchanged.')
      } catch (err) {
        console.error('Error: ', err)
        console.log('Error stringified: ' + JSON.stringify(err, null, 2))
        throw err
      }
    })

    it('should not be able to update other user when not admin', async () => {
      try {
        const options = {
          method: 'PUT',
          uri: `${LOCALHOST}/users/${context.user2._id.toString()}`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Authorization: `Bearer ${context.token}`
          },
          body: {
            user: {
              name: 'This should not work'
            }
          }
        }

        let result = await rp(options)

        console.log(`result stringified: ${JSON.stringify(result, null, 2)}`)
        assert(false, 'Unexpected result')
      } catch (err) {
        if (err.statusCode === 401) {
          assert(err.statusCode === 401, 'Error code 401 expected.')
        } else {
          console.error('Error: ', err)
          console.log('Error stringified: ' + JSON.stringify(err, null, 2))
          throw err
        }
      }
    })

    it('should be able to update other user when admin', async () => {
      const adminJWT = context.adminJWT

      const options = {
        method: 'PUT',
        uri: `${LOCALHOST}/users/${context.user2._id.toString()}`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Authorization: `Bearer ${adminJWT}`
        },
        body: {
          user: {
            name: 'This should work'
          }
        }
      }

      let result = await rp(options)
      // console.log(`result stringified: ${JSON.stringify(result, null, 2)}`)

      const userName = result.body.user.name
      assert.equal(userName, 'This should work')
    })
  })

  describe('DELETE /users/:id', () => {
    it('should not delete user if token is invalid', async () => {
      try {
        const options = {
          method: 'DELETE',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer 1`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should throw 401 if deleting other user', async () => {
      const { token } = context

      try {
        const options = {
          method: 'DELETE',
          uri: `${LOCALHOST}/users/1`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }

        await rp(options)
        assert.equal(true, false, 'Unexpected behavior')
      } catch (err) {
        assert.equal(err.statusCode, 401)
      }
    })

    it('should not be able to delete other users unless admin', async () => {
      try {
        const options = {
          method: 'DELETE',
          uri: `${LOCALHOST}/users/${context.user2._id.toString()}`,
          resolveWithFullResponse: true,
          json: true,
          headers: {
            Authorization: `Bearer ${context.token}`
          }
        }

        let result = await rp(options)

        console.log(`result stringified: ${JSON.stringify(result, null, 2)}`)
        assert(false, 'Unexpected result')
      } catch (err) {
        if (err.statusCode === 401) {
          assert(err.statusCode === 401, 'Error code 401 expected.')
        } else {
          console.error('Error: ', err)
          console.log('Error stringified: ' + JSON.stringify(err, null, 2))
          throw err
        }
      }
    })

    it('should delete own user', async () => {
      const {
        user: { _id },
        token
      } = context

      const options = {
        method: 'DELETE',
        uri: `${LOCALHOST}/users/${_id}`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const result = await rp(options)
      // console.log(`result: ${util.inspect(result.body)}`)

      assert.equal(result.body.success, true)
    })

    it('should be able to delete other users when admin', async () => {
      const id = context.id2
      const adminJWT = context.adminJWT

      const options = {
        method: 'DELETE',
        uri: `${LOCALHOST}/users/${id}`,
        resolveWithFullResponse: true,
        json: true,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${adminJWT}`
        }
      }

      const result = await rp(options)
      // console.log(`result: ${util.inspect(result.body)}`)

      assert.equal(result.body.success, true)
    })
  })
})
