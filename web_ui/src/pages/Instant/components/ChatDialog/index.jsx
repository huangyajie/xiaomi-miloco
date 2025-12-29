/**
 * Copyright (C) 2025 Xiaomi Corporation
 * This software may be used and distributed according to the terms of the Xiaomi Miloco License Agreement.
 */

import React, { useRef, useEffect, useCallback } from 'react'
import { message } from 'antd'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import { useChatStore, useSessionChatStore } from '@/stores/chatStore';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { MessageRenderer, LoadingIndicator } from '@/components/MessageRenderer';
import { Icon } from '@/components';
import { chatDialogWelcomeMessages } from '@/constants/instantConfigTypes';
import Send from '../Send';
import styles from './index.module.less'


/**
 * ChatDialog Component - Main chat interface with message display and input
 * 聊天对话框组件 - 带有消息显示和输入功能的主聊天界面
 *
 * @returns {JSX.Element} Chat dialog component
 */
const ChatDialog = () => {
  const { t } = useTranslation();

  const {
    messages,
    isAnswering,
    currentAnswer,
    answerMessages,
    setIsScrollToBottom,
    globalSendMessage,
    socketWaiting,
  } = useChatStore()

  // session storage management
  const {
    restoreTempChatState,
    hasTempChatState,
    clearTempChatState
  } = useSessionChatStore()

  const messagesEndRef = useRef(null)

  const socketActions = useGlobalSocket()

  const {
    messagesRef,
    clearAutoScroll,
    forceStartAutoScroll,
    handleScroll
  } = useAutoScroll({
    isAnswering,
    setIsScrollToBottom,
    messages,
    scrollInterval: 200,
    scrollThreshold: 30,
    debounceDelay: 50
  })

  // check if there is a conversation
  const hasMessages = messages.length > 0;

  const { saveStateBeforeLeave } = socketActions;

  // component initialization, restore state
  useEffect(() => {
    // check if there is a temporary chat state to restore
    if (hasTempChatState()) {
      const tempState = restoreTempChatState();
      if (tempState.messages && tempState.messages.length > 0) {
        useChatStore.setState({
          messages: tempState.messages,
          currentAnswer: tempState.currentAnswer,
          answerMessages: tempState.answerMessages,
          isAnswering: tempState.isAnswering,
          sessionId: tempState.sessionId,
          isHistoryMode: false // not history mode when restoring
        });

        console.log('Chat state restored:', {
          messagesCount: tempState.messages.length,
          isAnswering: tempState.isAnswering,
          sessionId: tempState.sessionId
        });
      }

      // clear temporary state
      clearTempChatState();
    }
  }, [hasTempChatState, restoreTempChatState, clearTempChatState]);


  const handleWelcomeMessageClick = useCallback(async (content) => {
    // use global send message method, handle all common logic
    const messageData = await globalSendMessage(
      content,
      ['miot_manual_scenes', 'miot_devices', 'ha_automations', 'ha_devices'], // default MCP list for welcome message
      {
        onBeforeSend: () => {

        }
      }
    );

    if (!messageData) { return; } // send failed or blocked

    try {
      // use global Socket to send message
      const requestId = socketActions.sendMessage(messageData);

      console.log('Welcome message Socket send success, request ID:', requestId);

    } catch (error) {
      console.error('Welcome message Socket send failed:', error);
      message.error(t('instant.chat.sendMessageFailed'));
      // need to manually reset state when send failed
      const { setIsAnswering } = useChatStore.getState();
      setIsAnswering(false);
    }
  }, [globalSendMessage, socketActions, t]);


  const stateRef = useRef({ messages, isAnswering });
  useEffect(() => {
    stateRef.current = { messages, isAnswering };
  }, [messages, isAnswering]);

  useEffect(() => {
    return () => {
      const { messages: currentMessages, isAnswering: currentIsAnswering } = stateRef.current;
      if (currentMessages.length > 0 || currentIsAnswering) {
        console.log('ChatDialog component unmount, save current state');
        saveStateBeforeLeave();
      }
    };
  }, [saveStateBeforeLeave]);

  return (
    <div className={styles.chatDialogWrap}>
      <div className={styles.chatDialogHeader}>
        <div className={styles.chatDialogHeaderTitle}>Xiaomi Miloco</div>
      </div>

      {hasMessages && (
        <div
          className={styles.messages}
          ref={messagesRef}
          onScroll={handleScroll}
        >
          {messages.map((msg, idx) => {
            const messageKey = msg.sessionId ? `${msg.sessionId}-${idx}` : `msg-${idx}`;

            return (
              <div key={messageKey} className={msg.type === 'question' ? styles.question : styles.answer}>

                {msg.type === 'answer' && msg.socketMessages && msg.socketMessages.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                  }}>
                    {msg.socketMessages.map((socketMsg, socketIdx) => {
                      const socketKey = socketMsg?.header?.request_id && socketMsg?.header?.timestamp
                        ? `${socketMsg.header.request_id}-${socketMsg.header.timestamp}-${socketIdx}`
                        : `socket-${messageKey}-${socketIdx}`;

                      return (
                        <MessageRenderer
                          key={socketKey}
                          messageData={socketMsg}
                          isComplete={msg.isComplete}
                          allMessages={msg.socketMessages}
                        />
                      );
                    })}
                    {isAnswering && idx === messages.length - 1 && socketWaiting && (
                      <div style={{ minHeight: '45px', marginTop: '-20px', marginBottom: '-15px' }}>
                        <LoadingIndicator showText={false} />
                      </div>
                    )}

                  </div>
                ) : (
                  msg.text && <ReactMarkdown>{msg.text}</ReactMarkdown>
                )}

                {msg.type === 'answer' && (
                  <div className={styles.aiGenerated}>{t('instant.chat.aiGenerated')}</div>
                )}

              </div>
            );
          })}
          {isAnswering && !currentAnswer && (!answerMessages || answerMessages.length === 0) && (
            <div className={styles.answer}>
              <LoadingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {
        !hasMessages && (
          <div className={styles.welcomeWrap}>
            <div className={styles.welcome}>
              <div className={styles.welcomeTextTitle}>
                <span>{t('instant.chat.welcomeContent')}</span>
              </div>

              <div className={styles.featuresGrid}>
                {chatDialogWelcomeMessages.map((item, index) => (
                  <div className={styles.featureCard} key={index}>
                    <div className={styles.featureTitle}>{t(item.title)}</div>
                    <div className={styles.featureContent}>{item.content.map((content, contentIndex) => (
                      <div
                        key={contentIndex}
                        className={styles.clickableContent}
                        onClick={() => handleWelcomeMessageClick(t(content))}
                      >
                        {t(content)}
                      </div>
                    ))}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }
      <div className={styles.sendContainerBottom}>
        <Send
          openTimeoutGoToBottom={forceStartAutoScroll}
          clearTimeoutGoToBottom={clearAutoScroll}
        />
      </div>
    </div>
  )
}


export default ChatDialog
