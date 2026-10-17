package com.example.security

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import com.example.R
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.tasks.await

/**
 * Production Google Sign-In and Firebase Authentication Manager.
 * Uses Jetpack Credential Manager library with single-option exclusivity per request.
 */
class GoogleAuthManager(private val context: Context) {

    private val credentialManager = CredentialManager.create(context)
    private val auth: FirebaseAuth = Firebase.auth

    val currentUser: FirebaseUser?
        get() = auth.currentUser

    /**
     * Interactive Google Sign-In using GetSignInWithGoogleOption.
     * Complies with Credential Manager Option Exclusivity (single option per request).
     */
    suspend fun signInWithGoogle(activity: Activity): Result<FirebaseUser> {
        val serverClientId = context.getString(R.string.default_web_client_id)

        val signInWithGoogleOption = GetSignInWithGoogleOption.Builder(serverClientId)
            .build()

        val credentialRequest = GetCredentialRequest.Builder()
            .addCredentialOption(signInWithGoogleOption)
            .build()

        return try {
            val result = credentialManager.getCredential(
                request = credentialRequest,
                context = activity
            )

            val credential = result.credential
            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
            val idToken = googleIdTokenCredential.idToken

            // Sign in to Firebase Auth with the Google ID Token
            val firebaseCredential = GoogleAuthProvider.getCredential(idToken, null)
            val authResult = auth.signInWithCredential(firebaseCredential).await()
            val user = authResult.user

            if (user != null) {
                Log.i(TAG, "Firebase Authentication successful for user: ${user.email} (${user.uid})")
                Result.success(user)
            } else {
                Log.e(TAG, "Firebase user is null after authentication")
                Result.failure(IllegalStateException("Firebase user was null after sign-in"))
            }
        } catch (e: GetCredentialCancellationException) {
            // Cancellation is not a crash, user dismissed bottom sheet
            Log.w(TAG, "User cancelled Google Sign-In prompt", e)
            Result.failure(e)
        } catch (e: GetCredentialException) {
            Log.e(TAG, "Credential Manager error during Google Sign-In: ${e.type}", e)
            Result.failure(e)
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error during Google Sign-In with Firebase", e)
            Result.failure(e)
        }
    }

    /**
     * Silent Auto Sign-In using GetGoogleIdOption in a separate request.
     */
    suspend fun trySilentSignIn(activity: Activity): Result<FirebaseUser> {
        val serverClientId = context.getString(R.string.default_web_client_id)

        val getGoogleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(true)
            .setServerClientId(serverClientId)
            .setAutoSelectEnabled(true)
            .build()

        val credentialRequest = GetCredentialRequest.Builder()
            .addCredentialOption(getGoogleIdOption)
            .build()

        return try {
            val result = credentialManager.getCredential(
                request = credentialRequest,
                context = activity
            )

            val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(result.credential.data)
            val idToken = googleIdTokenCredential.idToken
            val firebaseCredential = GoogleAuthProvider.getCredential(idToken, null)
            val authResult = auth.signInWithCredential(firebaseCredential).await()
            val user = authResult.user

            if (user != null) {
                Result.success(user)
            } else {
                Result.failure(IllegalStateException("User is null"))
            }
        } catch (e: Exception) {
            Log.d(TAG, "Silent sign-in not available or failed: ${e.message}")
            Result.failure(e)
        }
    }

    /**
     * Signs out of Firebase Auth and clears local Credential Manager state.
     */
    suspend fun signOut() {
        try {
            auth.signOut()
            credentialManager.clearCredentialState(ClearCredentialStateRequest())
            Log.i(TAG, "User signed out and credential state cleared")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing credential state on sign out", e)
        }
    }

    companion object {
        private const val TAG = "GoogleAuthManager"
    }
}
