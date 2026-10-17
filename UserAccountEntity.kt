package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "user_accounts")
data class UserAccountEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val email: String,
    val passwordHash: String,
    val fullName: String,
    val mobileNumber: String = "+91 98765 43210",
    val targetExam: String = "JEE 2026",
    val targetScore: String = "280+ / 300",
    val targetCollege: String = "IIT Bombay / AIIMS Delhi",
    val bio: String = "Disciplined aspirant on a 60-day rigorous study sprint.",
    val avatarColor: Long = 0xFF6574FF,
    val role: String = "USER", // "ADMIN" or "USER"
    val authProvider: String = "GOOGLE", // "GOOGLE" or "EMAIL"
    val registeredAt: Long = System.currentTimeMillis(),
    val lastLoginAt: Long = System.currentTimeMillis()
)
