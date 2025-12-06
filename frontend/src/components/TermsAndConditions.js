const TermsAndConditions = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Terms and Conditions</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <h3>1. ACCEPTANCE OF TERMS</h3>
          <p>1.1. When opening an account on the website, visiting or using any section of our club (hereinafter referred to as the Website) You accept the terms and conditions of the website, the rules of any of the games, the terms of promotional activities, bonuses, special offers, and also agree to the privacy policy. All the rules mentioned above are hereinafter referred to as "Conditions". Read the Terms carefully before accepting them. If for any reason you are not ready to accept the Terms, we ask you not to open an account and/or not to continue using the Website. By continuing to use the Website, you confirm your acceptance of the Terms.</p>

          <h3>2. LINKS</h3>
          <p>2.1. You use any links provided on the website for informational or advertising purposes at your own discretion and at your own risk. The Company is not responsible for the content of any third-party sites, actions or omissions of their owners, for the content of third-party advertising and sponsorship on these sites. The Website may contain links to other sites that are also outside the Company's control and are not mentioned in the Terms.</p>

          <h3>3. CHANGES TO CONDITIONS</h3>
          <p>3.1. We reserve the right to edit, update and change any Terms and Conditions for reasons related to customer service, as well as for reasons of changing laws and regulations. In case of changes/updates of the Terms, all information will be provided on the Website. The Player is responsible for familiarizing himself with the current Conditions. The Company has the right to make any changes to the operation of the site, to the software and to the procedure for providing services without prior notice to the player, as well as to change the requirements in accordance with current legislation, the fulfillment of which is necessary for access and use of the services.</p>
          <p>3.2. In case of disagreement with the changes, you can close your account and/or stop using the Website by fulfilling clause 13 of these Terms. If, after the effective date of the revised Terms, you continue to use any part of the Website, we consider this as consent and acceptance of the revised Terms, including (for the avoidance of doubt) any additions, deletions, substitutions or other changes to these Terms.</p>
          <p>3.3. A withdrawal fee of 12% of the withdrawal amount is charged</p>

          <h3>4. LEGAL REQUIREMENTS</h3>
          <p>4.1. The services of the Website cannot be used by persons under the age of 18. The use of the site's services by persons under the age of 18 is a violation of the Terms. The Company has the right to request documentary confirmation of the age of the player at any stage to make sure that he has reached the age of eighteen. The Company has the right to refuse to use the service and suspend the player's account if he has not provided documentary proof of his age, or if the Company suspects that a player under the age of 18 is using the service.</p>
          <p>4.2. You use the services provided by the Website at your own choice and discretion. You assume responsibility when deciding whether the use of the Website services is legal in accordance with the applicable laws of your jurisdiction. You understand and accept that online gambling may be illegal in some jurisdictions, as well as that the company is unable to provide you with legal advice or guarantees regarding the legality of your use of the Website services.</p>
          <p>4.3. You confirm, guarantee and agree that the use of the services on the Website complies with all applicable laws, statutes and rules of your jurisdiction. You understand and accept the fact that the company does not bear any responsibility for any illegal or unauthorized use of the Website services by you.</p>
          <p>4.4. The Player is fully responsible for paying all taxes and fees applied in connection with any winnings received as a result of using the Website. The player is also responsible for reporting his winnings and/or losses to the relevant authorities, if the winnings are subject to taxation according to any decisions and acts issued by local legislative, tax or other authorities.</p>

          <h3>5. OPENING AN ACCOUNT</h3>
          <p>5.1. To start using the services of the Website, you must open an account ("Your Account"). To do this, you must specify your email address and choose a password, as well as provide personal information, including your name, date of birth and phone number. The password you have chosen will be used to log in to the system in the future.</p>
          <p>5.2. When registering, you must specify your true name. In order to confirm the truth of the data provided by you, the Company reserves the right at any time to request a document proving your identity (including, but not limited to: a copy of your passport / ID card / or any payment card used). If you are unable to provide such information for any reason, the Company has the right to suspend your account until the required data is provided, and/or permanently close your account if they are not provided.</p>
          <p>5.3. You confirm that when registering on the Website, you have provided accurate, complete and reliable information about yourself, and, in case of any changes, you will make appropriate corrections to this information. In case of non-compliance with this requirement, the Company may apply restrictions on transactions, receiving bonuses and/or closing your account.</p>
          <p>5.4. If you encounter any problems during registration, or you have any questions, you can contact the support service by email in the "Contacts" section.</p>
          <p>5.5. You can open only one account on the Website. Other accounts opened by you will be treated as a "Duplicate Account" and closed, as well as:</p>
          <p>5.5.1. All transactions made from a Duplicate Account are invalidated;</p>
          <p>5.5.2. All bets or deposits made using a Duplicate Account have been refunded;</p>
          <p>5.5.3. Any refunds, winnings or bonuses received or made during the use of an active Duplicate Account</p>
        </div>
        
        <h3>6. PROOF OF YOUR IDENTITY; MONEY LAUNDERING PROTECTION REQUIREMENTS</h3>
        <p>6.1. Taking into account the rights given to you to use the services, you guarantee, confirm, undertake and agree that:</p>
        <p>6.1.1. You have reached the age that is legally permitted to participate in gambling according to the legislation of your jurisdiction.</p>
        <p>6.1.2. You are the rightful owner of the funds in your account. All information provided by you during the registration process and/or at a subsequent time, including within the framework of any transaction, is correct, up-to-date, accurate and fully corresponds to the name(s) on the credit/debit payment card(s) or other settlement accounts that will be used to deposit or receive funds to your account/from your account.</p>
        <p>6.1.3. You are aware, understand and accept the fact that in the process of using the services on the Website you may lose money. You are aware that you are fully responsible for any losses associated with the use of the services of this Website. You agree that you use the services solely by your own choice, decision and at your own risk. If you lose, you have no right to make any claims against the Company.</p>
        <p>6.1.4. You understand the general rules, methods and procedures for the provision of services and games on the Internet. You understand that you are responsible for ensuring that these bets and games are correct. You agree not to commit any actions or actions that may damage the reputation of the Company.</p>
        <p>6.2. By accepting the Terms, you agree that the Company may periodically conduct inspections, both at its discretion and at the request of third parties (including regulatory authorities) to confirm your identity and contact information ("Verification").</p>
        <p>6.3. You agree that the possibility of withdrawing funds from your account during inspections may be limited by the Company.</p>
        <p>6.4. The Company has the right to close your account immediately and/or refuse to use the Website services if you provide false, inaccurate, misleading and/or incomplete information.</p>
        <p>6.5. The Company has the right to suspend your account if it is impossible to confirm that you have reached the age of 18. If at the time of your participation in gambling-related operations on the Website, your age was less than Acceptable, then in such a case we withdraw from the obligation to refund or otherwise compensate you for the funds in your account:</p>
        <p>6.5.1. your account will be closed;</p>
        <p>6.5.2. all transactions made during this time will be canceled, and the funds deposited by you to the account will not be refunded, and will also be considered returned at the expense of the withdrawn funds;</p>
        <p>6.5.3. any bets made by you during this time will be canceled and non-refundable, and will also be considered refunded at the expense of the withdrawn funds;</p>
        <p>6.5.4. Any winnings accumulated during the period when your age was less than Acceptable will be lost by you, and you will have to return to us all the funds that were withdrawn from your account upon request.</p>
    
        <h3>7. USERNAME, PASSWORD AND SECURITY</h3>
        <p>7.1. After opening an account, your username and password must remain confidential. If you have lost or forgotten your account data, you can restore your password by clicking on the "Remind password" button at the link located below the login window.</p>
        <p>7.2. After opening an account, you are fully responsible for the safety of your password. You are also responsible for any actions and transactions carried out on your account and for all losses on your account incurred by you through the fault of third parties.</p>
        <p>7.3. In case of unauthorized access to your account and/or any other security breach, you are obliged to notify the Company immediately. You agree to provide evidence of such unauthorized access upon request. Under no circumstances will the Company be liable for any damage suffered by you as a result of misuse of your username and password by another person or for unauthorized access to your Account, regardless of whether they were authorized by you or without your knowledge.</p>
        <p>7.4. In the event of any questionable activity, the Security Service has the right to request an additional account identification procedure.</p>
        <p>7.4.1. For identification, you will need to send us a photo of your identification document, such as a passport or ID card, as well as a selfie with the first page of your passport in the background of our website or with the name of the site written on paper. The series and passport number may be painted over in the image. If you topped up your account using a plastic card, you must also send copies of the front and back sides of this card. The first six and last four digits of the card must be visible in the card number (please note that if you have an embossed card number, the same digits on the back side must be covered as on the front). The CVV2 code must also be filled in. It is also necessary to make a control payment in the amount of 20% of the amount of ordered transactions.</p>
    
        <h3>8. DEPOSITS AND WITHDRAWALS</h3>
        <p>8.6. You have the right to use several phone numbers, but with mandatory confirmation of each number, if you top up your account using the paid SMS service. This number must be specified in your profile. It is forbidden to take any form of loans from a mobile network operator. It is forbidden to make SMS deposits using SMS loans with a negative account balance. If this rule is violated, your account will be blocked without the possibility of withdrawing funds.</p>
        
        <p>8.7. We do not accept cash sent to us. We have the right to use third-party electronic payment processing organizations and/or financial institutions to process both your payments and payments to you, only if the terms and conditions of such third-party electronic payment processing organizations and/or financial institutions do not contradict the provisions of these Terms.</p>
        
        <p>8.8. You undertake not to abandon previously conducted transactions, not to cancel them in any other way, not to cancel any operations for placing money on your account, and in any of such cases, you undertake to return and compensate us for such non-deposited funds, including any expenses incurred by us in the process of collecting your deposits.</p>
        
        <p>8.9. The Company reserves the right to block your account, cancel any payments made and recover any winnings in case of suspicious or fraudulent cash deposits, including the use of stolen credit cards and/or any other fraudulent activity (including any refunds or cancellations of payments). We have the right to inform the relevant authorities and/or organizations (including credit information agencies) about any payment fraud or other illegal activity. We reserve the right to hire collection agencies to refund payments. The Company is under no circumstances liable for any unauthorized use of credit cards, regardless of whether the theft of the credit card was reported or not.</p>
        
        <p>8.10. We may at any time set off any positive balance of your account in favor of any amount that you owe to the Company, including (without limitation) cases of repeated betting or betting, in accordance with clause 5.5, clause 11 ("Collusion, misleading actions, fraud and criminal activity") or paragraph 16 ("Errors and omissions").</p>
        
        <p>8.11. You understand and agree that your account is not a bank account, and therefore, no insurance, guarantees, deposits or other protection tools from deposit insurance or bank insurance systems, as well as any similar insurance systems, apply to it. No interest is accrued on the funds deposited in your account.</p>
        
        <p>8.12. You can submit a request to withdraw money from your account at any time, provided that:</p>
        <p>8.12.1. All payments transferred to your account have been checked for the absence of unacceptable actions, and no payment has been canceled or otherwise canceled;</p>
        <p>8.12.2. Any verification actions mentioned in Section 6 have been properly carried out;</p>
        
        <p>8.13. When making an application for cashing funds, the following points must be taken into account:</p>
        <p>8.13.1. In order for the withdrawal of funds to be available, you need to make three deposits. These actions are necessary in order to avoid clogging the BC with bots. In the future, the full amount of funds will be available for transactions.</p>
        <p>8.13.2. The information in your profile must be filled in, the account identified (verified). For identification, you will need to send us a photo of your identity document, such as a passport or ID card, as well as a selfie with the first page of your passport against the background of our website or with an inscription on paper. The passport series and number can be painted over on the image. If you have topped up your account using a plastic card, you must also send copies of the front and back sides of this card. The first six and last four digits of the card should be visible in the card number (note that if you have a relief card number, then the same digits should be covered on the reverse side as on the front). The CVV2 code should also be painted over.</p>
        <p>8.13.3. You can withdraw funds from the account only to your personal details. At the same time, it is necessary to use only one withdrawal method, the use of different withdrawal options is prohibited.</p>
        <p>8.13.4. In accordance with the MasterCard rules, we will not be able to return funds to your MasterCard credit card. Thus, deposits made with a MasterCard credit card will be refunded using alternative payment methods.</p>
        <p>8.13.5. To withdraw funds, you must pay a fee of 12% of the withdrawal amount. Commission is not deducted from the balance.</p>
        <p>8.13.6. You can withdraw from the account an amount equivalent to no more than 500 US dollars per day, 5000 US dollars per week and 20,000 US dollars per month. If you are playing for large bets, the Company has the right to change the terms of withdrawal of funds in your favor.</p>
        <p>8.13.7. If you win an amount equivalent to US$ 20,000 or more, the Company has the right to divide the payments into monthly payments of US$ 20,000 until the entire amount is paid without interest payments on the debt. Winnings from progressive jackpots do not fall under these conditions.</p>
        <p>8.13.8. The Company is not responsible for any delays in payment processing that occur after the withdrawal request has been processed by our managers. Withdrawal requests are processed seven days a week.</p>
        <p>8.13.9. If the funds were transferred using the services of a telephone operator, the payment is made only after checking the receipt of the last deposit to your account in the specified way for possible fraud.</p>
        <p>8.13.10. Funds received with the help of a no deposit bonus cannot be withdrawn until the bonus is wagered. When the bonus wagering is completed, the amount of funds is transferred from your bonus balance to the cash balance and can be withdrawn, however, the withdrawal of funds received as a result of wagering without a deposit bonus is carried out only to a registered bank card, to QIWI cards and all similar payment systems.</p>
        <p>8.13.11 The payout period of winnings depends on the amount of funds withdrawn:</p>
        <p>Winnings of an amount equivalent to less than $ 300 are paid within 3 working days after the official request (creation and confirmation of the withdrawal request). Money is transferred to the wallet/the account of the payment system selected by the Client.</p>
        <p>Winnings in the amount equivalent from 300 to 1500 US dollars rubles are paid within 5 working days from the date of filing an official application for withdrawal of funds.</p>
        <p>Winnings in the amount of $ 1,500 and above are paid out within 10 working days from the moment of submitting an application for withdrawal of funds.</p>
        <p>Regardless of the withdrawal amount, the club administration has the right to check the funds won. After making sure that there are no failures in the software, as well as the honesty of the winnings, all funds will be transferred to the player's account. Verification can take from 1 to 14 days from the moment of creation of the application for withdrawal of the won amount.</p>
        
        <p>8.13.12 The Client has the right to submit a request for withdrawal of money from the account, provided that he has performed a minimum number of actions to open a withdrawal of funds (specify the current information of the required number of deposits in the support chat).</p>
        
        <p>8.14. We have the right to withhold a commission in the amount of our withdrawal costs that were not involved in the game.</p>
        
        <p>8.15. Gambling on the Internet may be illegal in the jurisdiction in which you are located; if so, you do not have the right to use a payment card to make payments in favor of this site.</p>
        
        <h3>TERMS AND CONDITIONS FOR THE 1-CLICK SERVICE</h3>
        <p>9.1. You agree to pay for all services and/or goods or other additional services ordered by you on the Website, as well as all additional costs (if necessary), including, but not limited to, all kinds of taxes, duties, etc. You are fully responsible for the timely payment of all payments. The payment service provider only ensures that the payment is made in the amount indicated by the Website and is not responsible for the payment of the aforementioned additional amounts by the Website user.</p>
        
        <p>9.2. After clicking the "Payment" and/or "Pay" button, it is considered that the payment has been processed and it is irrevocably executed. By clicking the "Payment" and/or "Pay" button, you agree that you will not be able to withdraw the payment or request its withdrawal. By placing an order on the Website, you confirm and indicate that you do not violate the laws of any state. Additionally, by accepting the provisions of these rules (and/or Terms and Conditions), you, as the owner of the payment card, confirm that you have the right to use the goods and / or services offered on the Website.</p>
        
        <p>9.3. If you use the services of a Website offering such specific services as a gaming service, you provide a legally binding confirmation that you have reached or have already exceeded the age of majority, which is legally permitted in your jurisdiction in order to use the services provided by the Website.</p>
        
        <p>9.4. By starting to use the services of the Website, you assume legal responsibility for compliance with the laws of any state where this service is used, and confirm that the payment service provider does not bear any responsibility for any illegal or unauthorized such violation. By agreeing to use the services of the Website, you understand and accept that the processing of any of your payments is carried out by the payment service provider, and there is no legal right to refund services and/or goods already purchased or other payment cancellation options. If you want to opt out of using the service for the next purchase of the service and/or goods, you can opt out of the service using your Personal Account on the Website.</p>
        
        <p>9.5. The payment service provider is not responsible for the refusal/inability to process the data associated with your payment card, or for the refusal associated with the failure to receive permission from the issuing bank to make a payment using your payment card. The payment service provider is not responsible for the quality, volume, price of any service and/or goods offered to you or purchased by you on the Website using your payment card. When paying for any services and/or goods of the Website, you are, first of all, obliged to comply with the rules of use of the Website. Please note that only you, as the owner of the payment card, are responsible for the timely payment of any service and/or goods ordered by you through the Website and for all additional costs/commissions associated with this payment. The payment service provider is only the executor of the payment in the amount specified by the Website and is not responsible for any pricing, total prices and/or total amounts.</p>
        
        <p>9.6. In case of a situation related to your disagreement with the above conditions and/or other reasons, we ask you to cancel the payment in a timely manner and, if necessary, contact the administrator / support of the Website directly.</p>
        
        <h3>RULES OF THE GAME AND PLACING BETS ON THE SITE</h3>
        <p>10.1. Before confirming your transaction during the game, make sure that the information about any transaction you make is correct. You are responsible for this.</p>
        
        <p>10.2. The history of your transactions can be obtained by clicking on the "Check Bets" link on the Website.</p>
        
        <p>10.3. We reserve the right at any time to partially or completely (at our sole discretion) refuse to conduct any transaction requested by you through the Website if you have violated the Terms. No transaction is considered accepted until you receive confirmation from us. If you have not received confirmation that your transaction has been accepted, you need to contact customer support.</p>
        
        <p>10.4. You can cancel the transaction at any time by sending a request to the support service.</p>
        
        <p>10.5. Cancellation of the transaction takes effect after receipt of confirmation of cancellation.</p>
        <p>10.5.1. If the request to cancel the transaction was not received and/or not processed on time, you agree that your transaction may remain in the process of processing and be available for acceptance.</p>
        <p>10.6. You agree that due to technical and other reasons, the casino has the right to reduce any number to hundredths when calculating the amount of winnings. In this case, the rule applies: in any fractional number, two digits remain after the decimal point, the rest are discarded.</p>

        <h3>COLLUSION, MISLEADING ACTIONS, FRAUD AND CRIMINAL ACTIVITY</h3>
        <p>11.1. Not allowed:</p>
        <p>11.1.1. Provision of information to third parties;</p>
        <p>11.1.2. Fraud, including the use of malware, errors in our software, the use of automated players ("bots");</p>
        <p>11.1.3. Using illegally obtained credit or debit card data when replenishing your account;</p>
        <p>11.1.4. Participation in any criminal activity with criminal consequences;</p>
        <p>11.1.5. Entering into or attempting to enter into collusion, and/or intending to directly or indirectly participate in any collusion scheme with another player while playing on the Website.</p>
        <p>11.2. The Company reserves the right to suspend, revoke or cancel any payments or winnings related to bonus funds received from the Company (points, bonuses, etc.) if there is suspicion that you are trying to abuse them.</p>
        <p>11.3. The Company will take all reasonable measures to exclude, as well as to identify collusions and their participants. Appropriate measures will be taken in relation to them. We are not responsible for losses incurred by you or any other player as a result of collusion, fraudulent actions and other illegal transactions or deception.</p>
        <p>11.4. If you suspect that a person is in collusion or carries out fraudulent actions, you must inform us about it by email as soon as possible.</p>
        <p>11.5. If we suspect you of fraudulent activity, we may at any time, without prior notice, close your access to the services of the Website and block your account. In such a case, we disclaim the obligation to refund or otherwise compensate you for the funds in your account.</p>
        <p>11.6. It is prohibited to use the services and/or the software for any illegal or fraudulent activity. The Company reserves the right to suspend or block your and any other accounts in the system at any time and withhold funds in case of fraud detection.</p>

        <h3>OTHER PROHIBITED ACTIVITIES ON THE WEBSITE</h3>
        <p>12.1. The use of profanity, threats, belittling in relation to both players and employees of the Website is not allowed.</p>
        <p>12.2. It is prohibited to perform any actions that may affect the functioning of the site in any form. The distribution of viruses or similar malware, any mass distribution of information is prohibited. It is prohibited to distort, delete or otherwise modify any information contained on the Website.</p>
        <p>12.3. It is prohibited to use the Website for commercial purposes, to copy any information without prior agreement with the site administration.</p>
        <p>12.4. It is forbidden to hack the security system, try to gain access. In case of such actions, we will be forced to immediately block your account and close access to the site, as well as inform the relevant authorities about this.</p>
        <p>12.5. The Company is not responsible and does not compensate for losses in case of monetary losses caused by viruses, attacks, malfunctions of information technology tools when using the Website and/or downloading any materials posted on the Website and/or any links located on the Website.</p>
        <p>12.6. It is prohibited to sell or transfer accounts between players or intentionally lose chips for further transfer of chips to another player. Intentional loss of chips occurs when there is an intentional loss in order to transfer funds to another user.</p>

        <h3>VALIDITY AND CANCELLATION OF THE CONTRACT</h3>
        <p>13.1. You can terminate your account (including deleting your username and password) at any time by sending us an email.</p>
        <p>13.2. From the moment you sent us a letter requesting the closure of your account until you receive confirmation of the closure of your account, you are responsible for any activity on your account.</p>
        <p>13.3. The Company reserves the right to charge a commission or the amount you owe to the Company before closing your account. If your account is deleted, blocked or cancelled, the funds that were at the time of closing your account will not be refunded, and no other funds (for example, bonuses, additional points, etc.) will be credited to you or cashed out, and further access to your account will be impossible.</p>
        <p>13.4. Based on these Terms and Conditions, in case of cancellation of your account, neither party has any further obligations towards each other.</p>
        <p>13.5. The Company has the right to delete your account (including username and password) without prior notice if:</p>
        <p>13.5.1. For any reason, we have decided to stop providing services in general or specifically for you;</p>
        <p>13.5.2. If your account is linked in any way to an account that has been deleted.</p>
        <p>13.5.3. If your account is linked to existing blocked accounts. Except as provided in the Terms and Conditions, any balance in your account will be refunded to you within a certain period of time upon your request, after deducting the amount you owe to the Company;</p>
        <p>13.5.4. You are involved in collusion or trying to hack the system;</p>
        <p>13.5.5. You interfere with the software;</p>
        <p>13.5.6. You use your Account for purposes that can be considered illegal under the current law. For example, you are trying to access a Website from a jurisdiction where gambling is prohibited;</p>
        <p>13.5.7. You publish offensive information on the Website;</p>
        <p>13.6. If for an extended period of time (six months or more) Your account remains inactive, we may close or suspend it without notice. In the event of such closure of the account, the Conditions will be automatically canceled, starting from the effective date of such cancellation.</p>
        <p>13.7. The Company may close your account and cancel the Terms by sending you an email notification (or advance notification) to the email address associated with your account.</p>
        <p>In the event of any such cancellation on our part, except in situations where such closure and termination of the Terms are consistent with paragraph 10 ("Collusion, Deceptive Acts, Fraud and Criminal Activity") or paragraph 17 ("Violation of the Terms") of these Terms, we will refund the amount of your account balance. If we are unable to contact you, the funds will be transferred to the Company or the supervisory authority.</p>

        <h3>13.8. INACTIVE ACCOUNTS</h3>
        <p>13.8.1 If you have not placed bets from the Player's Account for a period of one hundred eighty (180) days (the “Grace Period”), your account will be deemed Inactive.</p>
        <p>13.8.2 As soon as your Account is deemed inactive, we will have the right to charge you a commission for maintaining a current account ('Inactive Account Commission'). We can deduct an amount equal to the Inactive Account Commission from your Game balance starting from the last day of the Grace Period, and then every thirty (30) days thereafter in accordance with the Inactive Account Commission Payment Schedule. If your Account continues to be recognized by us as an inactive account for a period of time equal to twelve consecutive months, as a guarantee of the safety of your funds, we may withhold any remaining funds in your Player Account and close your Player Account. You can contact us in order to claim the funds withheld within 5 years from the moment when you last made a Bet, minus all service fees due.</p>
        <p>13.8.3 We will stop withholding Inactive Account Commission from your Player Account if bets are placed on your account and it is reactivated or, in connection with the closure of the account in accordance with clause 13.1.</p>
        <p>13.8.4, the Inactive Account Commission is 5% of the amount on the account balance; the minimum commission amount is $5 or equivalent this amount is in another currency.</p>
        <p>13.8.5 The amounts of any types of commissions and other penalties may change from time to time.</p>

        <h3>CHANGES ON THE SITE</h3>
        <p>14.1. The Company has the right to make changes or supplement any service offered on the Website at any time in order to maintain and update the Website.</p>

        <h3>SYSTEM ERRORS</h3>
        <p>15.1. In case of any malfunction in the system or an error in the game (deviation from the normal functioning of the game logic for any reason), the Company will correct the situation as soon as possible. The Company is not responsible for information technology malfunctions caused by the operation of equipment used by you or other players to access the Website, as well as for failures in the operation of your Internet provider or the Internet provider of other players.</p>

        <h3>ERRORS OR OMISSIONS</h3>
        <p>16.1. In the process of using the services of the Website, certain circumstances may arise when the bet was accepted, or the payment was made with errors on the part of the Company (for example, incorrect setting of the conditions of game bets on our part as a result of an obvious error or omission when entering information, or as a result of a computer failure, or an error in the calculation made by us the amount of winnings/refunds due to you, including as a result of incorrect data entry manually or automatically).</p>
        <p>16.2. The Company may limit or cancel any bet.</p>
        <p>16.3. If you have used funds that have been credited to your account or have been transferred to you by mistake to place subsequent bets or participate in the game, we may cancel such bets and/or any winnings that you may receive using such funds, and if we have already paid you funds for such bets or games, then these amounts will be considered transferred to you in trust, and you will have to immediately return them to us at our request.</p>
        <p>16.4. The Company (including our employees or agents), partners or suppliers are not responsible for any damage, including loss of winnings, resulting from an error on your or our part.</p>
        <p>16.5. The Company and its licensees, distributors, subsidiaries, branches and all employees and directors are not liable for any loss or damage that may be caused by the interception or misuse of any information transmitted over the Internet.</p>

        <h3>LIMITATION OF OUR LIABILITY</h3>
        <p>17.1. You understand and accept the fact that the choice to use the services of the Website or not lies entirely with you, and you do this solely at your own choice, discretion and at your own risk.</p>
        <p>17.2. The operation of the Website is carried out according to the Conditions described on this Website. We make no further representations or warranties with respect to the Website or the services offered on the Website, and hereby exclude our liability (to the extent permitted by law) with respect to all implied warranties.</p>
        <p>17.3. The Company is not responsible for the content of any of the Internet sites that can be accessed through the Website. The Company is not responsible for contracts, torts, negligence, any damage or losses caused, including, but not limited to, loss of data, income, prestige, reputation, as well as for any losses that we cannot currently foresee.</p>

        <h3>VIOLATION OF THE TERMS</h3>
        <p>18.1. You understand and accept the fact that you will have to fully compensate us for any claims, liability, costs or expenses (including legal fees), as well as any other costs that may arise as a result of your violation of the Terms.</p>
        <p>18.2. You confirm that you are ready to fully compensate for losses, protect and defend the interests of the Company, its non-branded partners and their respective companies, as well as their respective officers, directors and employees from any claims, demands, liability, damages, losses, costs and expenses, including legal fees and any other expenses, arising for any reason due to:</p>
        <p>18.2.1. Violations of the Terms of Use by you;</p>
        <p>18.2.2. Violations by you of the law or the rights of third parties;</p>
        <p>18.2.3. Using your access to the services by any other person with or without your permission or accepting any winnings received in this way.</p>
        <p>18.3. If you violate the Terms, we reserve the right, but do not undertake</p>
        <p>18.3.1. Send you a notification (using your contact details) that you are violating the Terms by demanding to stop violations;</p>
        <p>18.3.2. Suspend your Account so that you cannot place bets or play games on the Website;</p>
        <p>18.3.3. Block Your Account;</p>
        <p>18.3.4. Cancel bonuses or winnings that you have acquired as a result of any serious violation;</p>
        <p>18.4. If you do not comply with any of the provisions of the Terms, the Company has the right to cancel your username and password.</p>

        <h3>INTELLECTUAL PROPERTY RIGHTS</h3>
        <p>19.1. The content of the Website is subject to copyright and other proprietary rights owned by the Company or used under a license from third-party copyright holders. The use of any materials posted on the Website for commercial purposes is prohibited.</p>
        <p>19.2. The use of the Website does not grant the user any intellectual property rights (e.g. copyrights, know-how or trademarks) owned by the Company or any other third party.</p>
        <p>19.3. It is prohibited to use or reproduce the trade name, trademark, logo or other creative materials presented on the Website.</p>
        <p>19.4. You undertake to compensate for any damage, costs or expenses incurred due to or in connection with the commission of any prohibited activity. You undertake to notify the Company of the commission of any prohibited activities by any person, to provide the necessary assistance to the Company and to provide all information regarding this issue that you have.</p>

        <h3>YOUR PERSONAL INFORMATION</h3>
        <p>20.1. We process the personal information provided by you strictly in accordance with the privacy policy.</p>
        <p>20.2. By providing the Company with personal information, you consent to the processing of your personal data for the purposes described by the Site administration in the Terms.</p>
        <p>20.3. We do not disclose players' personal information to anyone except employees who need access to the data to provide services.</p>
        <p>20.4. The Company stores the correspondence received from you (including copies of all emails) in order to accurately register all the information received from you.</p>
        <p>20.5. The Company has the right to send informational letters to the e-mail address specified by the user during registration.</p>

        <h3>USE OF COOKIES ON THE WEBSITE</h3>
        <p>21.1. In order to ensure the functionality of the Website, the Company uses cookies. Additional information on how to delete or control cookies is available on the website www.aboutcookies.org . Deleting the Company's cookies or taking measures to prohibit their storage on your computer in the future may lead to the inability to access certain sections or functions of the Website.</p>

        <h3>COMPLAINTS AND NOTIFICATIONS</h3>
        <p>22.1. To file a claim regarding the Website, please contact our support service.</p>
        <p>22.2. You understand and accept that the records on the server will act as final evidence in determining the outcome of any dispute.</p>
        <p>22.3. You accept the results of all games and acknowledge that the result is determined by a random number generator. If the information displayed on your screen does not match the balance on your account, the balance available on the Company's server is considered decisive.</p>

        <h3>INTERPRETATION</h3>
        <p>23.1. The original text of the Terms is written in European, so the European version has an advantage. Any interpretation of the Terms and Conditions text must be based on the original European text.</p>

        <p>24.1. The Company has the right to transfer, assign and sublicense or pledge the Terms, in whole or in part, to any person (without your consent), provided that such appointment will be on the same terms or conditions no less favorable to you.</p>

        <h3>FORCE MAJEURE CIRCUMSTANCES</h3>
        <p>25.1. The Company is not liable in case of non-fulfillment or delay in fulfillment of any of our obligations under the Conditions that are caused by force majeure, including natural disasters, wars, civil unrest, interruptions in public communication networks or services, industrial disputes or DDOS attacks and similar Internet attacks that may have adverse consequences ("Force majeure").</p>
        <p>25.2. For a period equal to the period of Force Majeure, there is a delay in the performance of obligations. The Company's activities during the period of Force Majeure are considered suspended. The Company will use all possible resources to stop the action of Force Majeure or to look for a solution by which it will be able to fulfill its obligations, despite Force Majeure.</p>

        <h3>DISCLAIMER OF OBLIGATIONS</h3>
        <p>26.1. If the Company fails to ensure that you strictly fulfill any of the obligations, or the Company is unable to exercise any of the rights or remedies to which it is entitled, this will not be a waiver of such rights or remedies, and will not release you from compliance with obligations.</p>
        <p>26.2. The Company's refusal to fulfill any of the obligations of the Conditions is not legally binding if it has not been formalized and has not been transmitted to you in writing, electronically or orally in accordance with the above.</p>

        <h3>DIVISIBILITY OF THE AGREEMENT</h3>
        <p>27.1. If any of the Terms lose their legal force, the terms "condition" or "provision" will be separated to an appropriate extent from the remaining terms, conditions and formulations, which will fully retain their legal force, as provided by law. In such cases, the part that is considered invalid is changed in accordance with applicable law in order to reflect the original goals as accurately as possible.</p>
      </div>
    </div>
  );
};

export default TermsAndConditions;
