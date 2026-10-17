package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface UserAccountDao {
    @Query("SELECT * FROM user_accounts WHERE LOWER(email) = LOWER(:email) LIMIT 1")
    suspend fun getUserByEmail(email: String): UserAccountEntity?

    @Query("SELECT * FROM user_accounts WHERE id = :id LIMIT 1")
    suspend fun getUserById(id: Long): UserAccountEntity?

    @Query("SELECT * FROM user_accounts ORDER BY lastLoginAt DESC")
    fun getAllUsers(): Flow<List<UserAccountEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserAccountEntity): Long

    @Update
    suspend fun updateUser(user: UserAccountEntity)

    @Query("DELETE FROM user_accounts WHERE id = :id")
    suspend fun deleteUser(id: Long)

    @Query("SELECT COUNT(*) FROM user_accounts")
    suspend fun getUserCount(): Int
}
