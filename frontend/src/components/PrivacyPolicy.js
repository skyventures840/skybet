const PrivacyPolicy = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Privacy Policy</h2>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <h3>Privacy policy</h3>
          <p>The text of the Policy is available to Users on the Internet directly on the website.</p>
          <p>The use of the Website means the expression by the User of unconditional consent to the Policy and the specified conditions for processing the information received.</p>

          <h3>1. Information received by the Website</h3>
          <p>1.1. The Website collects, accesses and uses the User's personal data, technical and other information related to the User for the purposes defined by the Policy.</p>
          <p>1.2. Technical information means information that is automatically transmitted to the Company during the use of the Website using the software installed on the User's device. Technical information is not personal data. The Website uses cookies and similar technologies that allow you to identify the User's device. Cookies are text files available to the Website for processing information about the activity of the User's device. The user can disable the use of cookies in the browser settings.</p>
          <p>1.3. The User's personal data means the information that the User provides to the Company through the Website and during subsequent interaction with the Company, including:</p>
          <p>1.3.1. surname, first name, patronymic;</p>
          <p>1.3.2. date of birth;</p>
          <p>1.3.3. email address;</p>
          <p>1.3.4. country and city of residence;</p>
          <p>1.3.5. mobile phone number;</p>
          <p>1.3.6. the number of the User's electronic wallet in payment systems;</p>
          <p>1.3.7. when withdrawing funds, documents confirming the identity of the Player and the number of the User's electronic wallet in payment systems.</p>
          <p>1.4. The Company processes the User's personal data, technical information and other information during the entire term of the agreement concluded with the User, and in the absence of such an agreement – within 5 (five) years from the date of provision of the specified information.</p>
          <p>1.5. The website is not a publicly available source of personal data. At the same time, if the User performs certain actions, his personal data may become available to an indefinite circle of persons, to which the User hereby gives his consent.</p>

          <h3>2. Purposes of using the information provided by the User</h3>
          <p>2.1. The information provided by the User is used by the Company solely for the purposes of:</p>
          <p>2.1.1. the conclusion of an agreement between the Company and the User, as well as the execution of such an agreement by the Company;</p>
          <p>2.1.2. providing the User with technical support;</p>
          <p>2.1.3. consideration of the User's requests and claims;</p>
          <p>2.1.4. sending advertising and/or informational materials to the User;</p>
          <p>2.1.5. improving the operation and modernization of the website;</p>
          <p>2.1.6. countering money laundering.</p>

          <h3>3. Processing methods</h3>
          <p>3.1. Processing of the User's personal data means recording, systematization, accumulation, storage, clarification (updating, modification), extraction, use, transfer (distribution, provision, access), depersonalization, blocking, deletion, destruction of the User's personal data that do not fall under special categories for the processing of which the Company, according to the current legislation European, the written consent of the User is required.</p>
          <p>3.2. The User gives his consent to the Company to process the User's personal data provided when filling out any form on the Website and during further interaction with the Website, including the transfer of such personal data to third parties pursuant to an agreement between the Company and the User, even when such transfer is carried out on the territory of other states (cross-border transfer).</p>
          <p>3.3. The processing of the User's personal data is carried out by the Company using databases located on the territory of the European.</p>

          <h3>4. Measures taken to protect the information provided by the User and guarantees by the Company</h3>
          <p>4.1. The Company takes necessary and sufficient legal, organizational and technical measures to protect the information provided by Users from unauthorized or accidental access, destruction, modification, blocking, copying, distribution, as well as from other illegal actions with it by third parties, by restricting access to such information by other Users of the Website, the Company, employees and partners of the Company, third parties (except for the provision of information by the Company, necessary to fulfill its obligations to the User and the requirements of European legislation), as well as imposing sanctions on such persons for violating the rules of the Policy regarding such data.</p>
          <p>4.2. The Company guarantees that the information provided by Users is not combined with statistical data, is not provided to third parties and is not disclosed, except as provided in the Policy.</p>

          <h3>5. Company Rights</h3>
          <p>5.1. The Company has the right to conduct statistical and other research based on depersonalized information provided by the User. The Company has the right to provide access to such research to third parties for advertising targeting. The User may also independently (if there is a technical possibility on the User's device or in software on the User's device) prohibit the device or software from transmitting information necessary for advertising targeting via the Website.</p>
          <p>5.2. The Company has the right to send the User an email- and sms-mailing of advertising and marketing materials, voice and/or sms messages, and/or other information by e-mail and/or by phone specified when registering an account on the Company's website or provided by the Client to the Company and/or a person authorized by him, in another way, about services and other services, payments, data on payment arrears, withdrawal of funds, changes in the rules and procedure for the provision of services and other changes, the Company's activities, promotions held by the Company or with its participation, sent by the Company or on its behalf by third parties.</p>
          <p>5.3. The Company has the right to provide information about Users to third parties in order to identify and prevent fraudulent actions, to eliminate technical problems or security problems, as well as in other cases provided for by the legislation of the European.</p>
          <p>5.4. The Company has the right to provide access to User information to third parties if such transfer is necessary for the Company to fulfill the agreement concluded with the User.</p>
          <p>5.5. If the User withdraws consent to the processing of personal data, the Company has the right to restrict the User's access to some or all functions of the Website.</p>

          <h3>7. New editions</h3>
          <p>7.1. The Company reserves the right to make changes to the Policy. The User is obliged to familiarize himself with the text of the Policy every time he accesses the Website.</p>
          <p>7.2. The new version of the Policy comes into force after 5 calendar days from the date of its publication. Continued use of the Website after the entry into force of the new version of the Policy means acceptance of the Policy and its terms by the User.</p>
          <p>7.3. The User should not use the Website if he does not agree with the terms of the Policy.</p>

          <h3>8. Exclusion of contradictions</h3>
          <p>8.1. If the agreement between the Company and the User contains provisions on the use of personal information and/or personal data of the User, the provisions of the Policy and such agreement in the part that does not contradict the Policy apply.</p>

          <h3>9. Use of cookies</h3>
          <p>9.1. We may collect data about your Internet usage using cookies. Cookies help us to improve the Website and make your time more enjoyable. With the help of cookies, we are able to identify you as a registered member of the Website, as well as store various information about your account in order to avoid re-entering this information as much as possible.</p>
          <p>9.2. You have the right to refuse the storage of cookies by selecting the appropriate option in your browser settings. However, if you do this, you will partially lose the ability to use some elements of our website.</p>
          <p>9.3. We reserve the right to use cookies if you do not set up a rejection in your browser.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
